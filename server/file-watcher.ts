import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { readFile, access } from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import log from 'electron-log';
import pino from 'pino';
import { ProjectDiscoveryEngine } from './discovery-engine';
import { addClaudeConfigAPI } from './claude-config-api';

// Configure structured logging with Pino
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  },
  base: {
    service: 'taskmaster-file-watcher',
    version: '2.0.0'
  }
});

// Keep electron-log as backup transport
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
log.transports.file.fileName = 'server.log';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB

// Type definitions
type DiscoveryMsgKind = 'discoveryProgress' | 'discoveryComplete' | 'discoveryError';

interface TaskData {
  tasks?: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface Project<T = TaskData> {
  id: string;
  name: string;
  path: string;
  tasksFilePath: string;
  data: T;
  lastUpdated: string;
}

interface DiscoveryProgress {
  type: DiscoveryMsgKind;
  progress?: {
    scannedDirs: number;
    foundProjects: number;
    currentPath?: string;
  };
  projects?: Array<{
    id: string;
    name: string;
    path: string;
    tasksFile: string;
    taskCount: number;
  }>;
  error?: string;
}

// Validation schemas
const ProjectSchema = z.object({
  id: z.string()
    .min(1, 'Project ID cannot be empty')
    .max(100, 'Project ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Project ID contains invalid characters'),
  name: z.string()
    .min(1, 'Project name cannot be empty')
    .max(200, 'Project name too long'),
  path: z.string()
    .min(1, 'Project path cannot be empty')
    .refine((p) => {
      // Prevent path traversal attacks
      const normalizedPath = path.normalize(p);
      return !normalizedPath.includes('..') && path.isAbsolute(normalizedPath);
    }, 'Invalid project path - must be absolute and not contain parent directory references')
});

const ProjectIdsSchema = z.object({
  projectIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]+$/))
    .min(1, 'At least one project ID required')
    .max(50, 'Too many project IDs')
});

const DiscoveryOptionsSchema = z.object({
  maxDepth: z.number().int().min(1).max(10).optional(),
  excludePatterns: z.array(z.string()).optional(),
  includePaths: z.array(z.string()).optional()
}).optional();

// Security middleware
function validateInput<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      } else {
        res.status(400).json({ error: 'Invalid request data' });
      }
    }
  };
}

function sanitizeFilePath(filePath: string, baseDir?: string): string | null {
  try {
    // First normalize the path
    const normalizedPath = path.normalize(filePath);
    
    // Ensure absolute path
    if (!path.isAbsolute(normalizedPath)) {
      return null;
    }
    
    // OWASP-recommended path traversal prevention
    if (baseDir) {
      const resolvedPath = path.resolve(baseDir, path.basename(normalizedPath));
      const resolvedBase = path.resolve(baseDir);
      
      if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
        logger.warn({ filePath, baseDir, resolvedPath, resolvedBase }, 'Path traversal attempt blocked');
        return null;
      }
    }
    
    // Additional security: only allow specific file extensions
    const allowedExtensions = ['.json'];
    const ext = path.extname(normalizedPath);
    if (!allowedExtensions.includes(ext)) {
      logger.warn({ filePath, extension: ext }, 'Invalid file extension blocked');
      return null;
    }
    
    // Prevent access to system files and hidden files
    const basename = path.basename(normalizedPath);
    if (basename.startsWith('.') && basename !== '.json') {
      logger.warn({ filePath, basename }, 'Hidden file access blocked');
      return null;
    }
    
    return normalizedPath;
  } catch (error) {
    logger.error({ filePath, error }, 'Path sanitization error');
    return null;
  }
}

// Enhanced error handler with structured logging
function handleError(error: unknown, req: Request, res: Response): void {
  const errorDetails = {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    } : 'Unknown error',
    timestamp: new Date().toISOString()
  };
  
  logger.error(errorDetails, 'Request error');
  
  // Don't expose internal error details in production
  const publicError = {
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { details: errorDetails })
  };
  
  res.status(500).json(publicError);
}

// Initialize Express app with security
const app = express();
const server = createServer(app);

// Security headers - CSP configured before helmet
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
  },
}));

// Apply other security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false // Allow WebSocket connections
}));

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', true);

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests for file watching endpoints
  skip: (req) => req.path === '/api/health'
});
app.use(limiter);

// Enhanced CORS with function for domain validation
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [/^https:\/\/[\w.-]+\.your-domain\.com$/] // Regex for production subdomains
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      return allowed.test(origin);
    });
    
    callback(null, isAllowed);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight for 24 hours
};
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware with structured logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    }, 'HTTP Request');
  });
  
  next();
});

// WebSocket server with modern upgrade handler
const wss = new WebSocketServer({ 
  noServer: true // We'll handle upgrades manually
});

// Modern WebSocket upgrade handler (replaces deprecated verifyClient)
server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  
  // Enhanced origin verification
  let isOriginAllowed = false;
  
  if (process.env.NODE_ENV === 'production') {
    // In production, validate against allowed origins
    const productionOrigins = [/^https:\/\/[\w.-]+\.your-domain\.com$/];
    isOriginAllowed = origin ? productionOrigins.some(pattern => pattern.test(origin)) : false;
  } else {
    // In development, allow localhost origins
    const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'];
    isOriginAllowed = !origin || devOrigins.includes(origin);
  }
  
  if (!isOriginAllowed) {
    logger.warn({ origin, ip: request.socket.remoteAddress }, 'WebSocket upgrade rejected - invalid origin');
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  
  // Check connection limits
  if (connections.size >= 100) {
    logger.warn({ connectionCount: connections.size }, 'WebSocket upgrade rejected - connection limit reached');
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Secure storage
const projects = new Map<string, Project>();
const fileWatchers = new Map<string, FSWatcher>();
const connections = new Set<WebSocket>();

// Initialize discovery engine
const discoveryEngine = new ProjectDiscoveryEngine();

// WebSocket connection handling with enhanced monitoring
wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  const connectionId = `${clientIp}-${Date.now()}`;
  
  logger.info({ clientIp, connectionId }, 'WebSocket client connected');
  connections.add(ws);
  
  // Enhanced heartbeat with timeout handling
  let isAlive = true;
  const heartbeat = setInterval(() => {
    if (!isAlive || ws.readyState !== WebSocket.OPEN) {
      clearInterval(heartbeat);
      connections.delete(ws);
      ws.terminate();
      logger.warn({ clientIp, connectionId }, 'WebSocket connection terminated due to inactivity');
      return;
    }
    
    isAlive = false;
    ws.ping();
  }, 30000);
  
  ws.on('pong', () => {
    isAlive = true;
  });
  
  ws.on('close', (code: number, reason: Buffer) => {
    connections.delete(ws);
    clearInterval(heartbeat);
    logger.info({ 
      clientIp, 
      connectionId, 
      code, 
      reason: reason.toString() 
    }, 'WebSocket client disconnected');
  });
  
  ws.on('error', (error: Error) => {
    logger.error({ clientIp, connectionId, error }, 'WebSocket error');
    connections.delete(ws);
    clearInterval(heartbeat);
  });
});

// Secure broadcast function with error handling
function broadcastUpdate(projectId: string, data: TaskData): void {
  const message = JSON.stringify({
    type: 'fileUpdate',
    projectId,
    data,
    timestamp: new Date().toISOString()
  });
  
  let successCount = 0;
  let errorCount = 0;
  
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error({ projectId, error }, 'Error broadcasting to WebSocket client');
        connections.delete(ws);
      }
    } else {
      // Clean up closed connections
      connections.delete(ws);
    }
  });
  
  logger.debug({ 
    projectId, 
    successCount, 
    errorCount, 
    totalConnections: connections.size 
  }, 'Broadcast update sent');
}

// Enhanced file watching with Chokidar
function watchTasksFile(projectId: string, filePath: string): void {
  const projectDir = path.dirname(filePath);
  const sanitizedPath = sanitizeFilePath(filePath, projectDir);
  
  if (!sanitizedPath) {
    throw new Error('Invalid file path');
  }
  
  // Close existing watcher if any
  if (fileWatchers.has(projectId)) {
    const existingWatcher = fileWatchers.get(projectId);
    existingWatcher?.close();
    fileWatchers.delete(projectId);
  }
  
  try {
    const watcher = chokidar.watch(sanitizedPath, {
      ignoreInitial: true,
      persistent: true,
      usePolling: false,
      atomic: 500, // Wait for file writes to complete
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });
    
    watcher.on('change', async () => {
      try {
        const content = await readFile(sanitizedPath, 'utf8');
        
        // Validate JSON structure
        let data: TaskData;
        try {
          data = JSON.parse(content);
        } catch (parseError) {
          logger.error({ 
            projectId, 
            filePath: sanitizedPath, 
            parseError 
          }, 'Invalid JSON in tasks file');
          return;
        }
        
        // Update project data
        const project = projects.get(projectId);
        if (project) {
          const updatedProject: Project = {
            ...project,
            data,
            lastUpdated: new Date().toISOString()
          };
          
          projects.set(projectId, updatedProject);
          
          // Broadcast to clients
          broadcastUpdate(projectId, data);
          
          logger.info({ 
            projectId, 
            taskCount: data.tasks?.length || 0,
            filePath: sanitizedPath
          }, 'Project data updated');
        }
      } catch (error) {
        logger.error({ 
          projectId, 
          filePath: sanitizedPath, 
          error 
        }, 'Error reading tasks file');
      }
    });
    
    watcher.on('error', (error) => {
      logger.error({ projectId, filePath: sanitizedPath, error }, 'File watcher error');
      fileWatchers.delete(projectId);
    });
    
    fileWatchers.set(projectId, watcher);
    
    logger.info({ projectId, filePath: sanitizedPath }, 'File watcher started');
  } catch (error) {
    logger.error({ projectId, filePath: sanitizedPath, error }, 'Failed to start file watcher');
    throw new Error(`Failed to watch file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// API Routes with enhanced security

// Add a new project to watch
app.post('/api/projects', validateInput(ProjectSchema), async (req: Request, res: Response) => {
  try {
    const { id, name, path: projectPath } = req.body;
    
    // Check if project already exists
    if (projects.has(id)) {
      res.status(409).json({ error: 'Project with this ID already exists' });
      return;
    }
    
    const tasksFilePath = path.join(projectPath, 'tasks', 'tasks.json');
    const sanitizedTasksPath = sanitizeFilePath(tasksFilePath);
    
    if (!sanitizedTasksPath) {
      res.status(400).json({ error: 'Invalid tasks file path' });
      return;
    }
    
    // Check if tasks.json exists and is readable
    try {
      await access(sanitizedTasksPath);
    } catch {
      res.status(404).json({ error: 'Tasks file not found or not accessible' });
      return;
    }
    
    // Read and validate initial data
    const content = await readFile(sanitizedTasksPath, 'utf8');
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      res.status(400).json({ error: 'Invalid JSON in tasks file' });
      return;
    }
    
    // Store project info
    const project: Project = {
      id,
      name,
      path: projectPath,
      tasksFilePath: sanitizedTasksPath,
      data,
      lastUpdated: new Date().toISOString()
    };
    
    projects.set(id, project);
    
    // Start watching
    watchTasksFile(id, sanitizedTasksPath);
    
    res.json({ success: true, project });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get all projects
app.get('/api/projects', (req: Request, res: Response) => {
  try {
    const projectList = Array.from(projects.values()).map(project => ({
      id: project.id,
      name: project.name,
      path: project.path,
      taskCount: project.data?.tasks?.length || 0,
      lastUpdated: project.lastUpdated
    }));
    
    res.json(projectList);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get specific project data
app.get('/api/projects/:id', (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }
    
    // Validate project ID
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      res.status(400).json({ error: 'Invalid project ID format' });
      return;
    }
    
    const project = projects.get(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    res.json(project);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Remove project
app.delete('/api/projects/:id', (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }
    
    // Validate project ID
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
      res.status(400).json({ error: 'Invalid project ID format' });
      return;
    }
    
    // Close file watcher
    if (fileWatchers.has(projectId)) {
      fileWatchers.get(projectId)?.close();
      fileWatchers.delete(projectId);
    }
    
    // Remove project
    const deleted = projects.delete(projectId);
    
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    res.json({ success: true });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Discovery Routes with enhanced security

// Start auto-discovery
app.post('/api/discovery/start', validateInput(DiscoveryOptionsSchema), async (req: Request, res: Response) => {
  try {
    const options = req.body || {};
    
    if (discoveryEngine.isScanning()) {
      res.status(409).json({ error: 'Discovery already in progress' });
      return;
    }

    // Set up progress broadcasting with error handling
    discoveryEngine.onProgress((progress) => {
      const message: DiscoveryProgress = {
        type: 'discoveryProgress',
        progress
      };
      
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(message));
          } catch (error) {
            logger.error({ error }, 'Error sending progress update');
            connections.delete(ws);
          }
        }
      });
    });

    // Start discovery in background
    discoveryEngine.runFullDiscovery(options)
      .then((discoveredProjects: any) => {
        const message: DiscoveryProgress = {
          type: 'discoveryComplete',
          projects: discoveredProjects
        };
        
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(message));
            } catch (error) {
              console.error('Error sending completion update:', error);
              connections.delete(ws);
            }
          }
        });
      })
      .catch((error: any) => {
        console.error('Discovery failed:', error);
        
        const message: DiscoveryProgress = {
          type: 'discoveryError',
          error: 'Discovery process failed'
        };
        
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(message));
            } catch (error) {
              console.error('Error sending error update:', error);
              connections.delete(ws);
            }
          }
        });
      });

    res.json({ 
      success: true, 
      message: 'Discovery started',
      progress: discoveryEngine.getProgress()
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get discovery status
app.get('/api/discovery/status', (req: Request, res: Response) => {
  try {
    res.json({
      isScanning: discoveryEngine.isScanning(),
      progress: discoveryEngine.getProgress(),
      discoveredCount: discoveryEngine.getDiscoveredProjects().length
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Get discovered projects
app.get('/api/discovery/projects', (req: Request, res: Response) => {
  try {
    const discoveredProjects = discoveryEngine.getDiscoveredProjects();
    res.json(discoveredProjects);
  } catch (error) {
    handleError(error, req, res);
  }
});

// Auto-add discovered projects
app.post('/api/discovery/add-selected', validateInput(ProjectIdsSchema), async (req: Request, res: Response) => {
  try {
    const { projectIds } = req.body;
    
    const discoveredProjects = discoveryEngine.getDiscoveredProjects();
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const projectId of projectIds) {
      const discoveredProject = discoveredProjects.find((p: any) => p.id === projectId);
      
      if (!discoveredProject) {
        results.push({ id: projectId, success: false, error: 'Project not found' });
        continue;
      }

      try {
        // Validate file path
        const sanitizedTasksFile = sanitizeFilePath(discoveredProject.tasksFile);
        if (!sanitizedTasksFile) {
          results.push({ id: projectId, success: false, error: 'Invalid tasks file path' });
          continue;
        }
        
        // Check if tasks.json exists and is readable
        const content = await readFile(sanitizedTasksFile, 'utf8');
        let data;
        try {
          data = JSON.parse(content);
        } catch {
          results.push({ id: projectId, success: false, error: 'Invalid JSON in tasks file' });
          continue;
        }
        
        // Add to projects
        const project: Project = {
          ...discoveredProject,
          tasksFilePath: sanitizedTasksFile,
          data,
          lastUpdated: new Date().toISOString()
        };
        
        projects.set(discoveredProject.id, project);
        
        // Start watching
        watchTasksFile(discoveredProject.id, sanitizedTasksFile);
        
        results.push({ id: projectId, success: true });
        console.log(`📊 Auto-added project: ${discoveredProject.name}`);
      } catch {
        results.push({ 
          id: projectId, 
          success: false, 
          error: 'Failed to add project' 
        });
      }
    }

    res.json({ results });
  } catch (error) {
    handleError(error, req, res);
  }
});

// Enhanced health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const health = {
    status: 'healthy',
    projectCount: projects.size,
    connections: connections.size,
    discoveryActive: discoveryEngine.isScanning(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };
  
  res.json(health);
});

// Readiness check for orchestration tools
app.get('/api/readyz', (req: Request, res: Response) => {
  const isReady = !discoveryEngine.isScanning() && projects.size >= 0;
  
  if (isReady) {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ 
      status: 'not ready', 
      reason: 'Discovery engine still scanning',
      timestamp: new Date().toISOString() 
    });
  }
});

// Add Claude Configuration API
addClaudeConfigAPI(app);

// Global error handler
app.use((error: any, req: Request, res: Response) => {
  handleError(error, req, res);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

// Enhanced server startup with health checks and timeout handling
async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverInstance = server.listen(PORT, () => {
      logger.info({
        port: PORT,
        projectCount: projects.size,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      }, 'TaskMaster File Watcher Server starting');
      
      // Server startup health check with timeout
      const healthCheckTimeout = setTimeout(() => {
        reject(new Error('Health check timeout after 5 seconds'));
      }, 5000);
      
      setTimeout(async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch(`http://localhost:${PORT}/api/health`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          clearTimeout(healthCheckTimeout);
          
          if (response.ok) {
            const healthData = await response.json();
            logger.info(healthData, 'Server health check passed - Server fully operational');
            logger.info('WebSocket server ready for connections');
            resolve();
          } else {
            throw new Error(`Health check failed with status: ${response.status}`);
          }
        } catch (error) {
          clearTimeout(healthCheckTimeout);
          logger.error({ error }, 'Server health check failed');
          reject(error);
        }
      }, 1000); // Give server 1 second to fully initialize
    });

    serverInstance.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn({ port: PORT }, 'Port already in use, trying alternatives');
        const altPorts = [3002, 3003, 3004, 3005];
        tryAlternativePorts(altPorts, 0, resolve, reject);
      } else {
        logger.error({ error }, 'Server startup error');
        reject(error);
      }
    });
  });
}

function tryAlternativePorts(
  ports: number[], 
  index: number, 
  resolve: () => void, 
  reject: (error: any) => void
): void {
  if (index >= ports.length) {
    reject(new Error('No available ports found'));
    return;
  }

  const altPort = ports[index];
  logger.info({ port: altPort }, 'Trying alternative port');
  
  // Create fresh server instance to avoid reuse issues
  const { createServer } = require('http');
  const freshServer = createServer(app);
  
  const altServerInstance = freshServer.listen(altPort, () => {
    logger.info({
      port: altPort,
      projectCount: projects.size,
      nodeVersion: process.version
    }, 'TaskMaster File Watcher Server running on alternative port');
    
    // Update PORT for health check
    process.env.PORT = altPort?.toString() || PORT.toString();
    
    setTimeout(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`http://localhost:${altPort}/api/health`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          logger.info({ port: altPort }, 'Server health check passed on alternative port');
          resolve();
        } else {
          throw new Error(`Health check failed with status: ${response.status}`);
        }
      } catch (error) {
        logger.error({ port: altPort, error }, 'Server health check failed on alternative port');
        reject(error);
      }
    }, 1000);
  });

  altServerInstance.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn({ port: altPort }, 'Alternative port also in use, trying next');
      tryAlternativePorts(ports, index + 1, resolve, reject);
    } else {
      logger.error({ port: altPort, error }, 'Alternative port startup error');
      reject(error);
    }
  });
}

// Start the server with robust error handling
startServer()
  .then(() => {
    logger.info('TaskMaster File Watcher Server initialization complete!');
  })
  .catch((error) => {
    logger.error({ error }, 'Failed to start TaskMaster File Watcher Server');
    process.exit(1);
  });

// Enhanced graceful shutdown with connection management
function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated');
  
  // Close all file watchers
  logger.info('Closing file watchers');
  const watcherPromises = Array.from(fileWatchers.entries()).map(([projectId, watcher]) => {
    return new Promise<void>((resolve) => {
      try {
        watcher.close();
        logger.info({ projectId }, 'File watcher closed');
        resolve();
      } catch (error) {
        logger.error({ projectId, error }, 'Error closing file watcher');
        resolve(); // Don't block shutdown on watcher errors
      }
    });
  });
  
  // Close WebSocket connections gracefully
  logger.info({ connectionCount: connections.size }, 'Closing WebSocket connections');
  connections.forEach(ws => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    } catch (error) {
      logger.error({ error }, 'Error closing WebSocket connection');
    }
  });
  
  // Give clients 2 seconds to close gracefully, then terminate
  setTimeout(() => {
    connections.forEach(ws => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
      }
    });
    logger.info('Terminated remaining WebSocket connections');
  }, 2000);
  
  // Close WebSocket server
  wss.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Wait for watchers to close, then close HTTP server
  Promise.all(watcherPromises).then(() => {
    server.close(() => {
      logger.info('HTTP server closed');
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
  });
  
  // Force close after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;