import express from 'express';
import { watch } from 'fs';
import { readFile, access } from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
// @ts-ignore - Module doesn't have TypeScript declarations
import { ProjectDiscoveryEngine } from './discovery-engine.js';
// @ts-ignore - Module doesn't have TypeScript declarations  
import { addClaudeConfigAPI } from './claude-config-api.js';
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
function validateInput(schema) {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                });
            }
            else {
                res.status(400).json({ error: 'Invalid request data' });
            }
        }
    };
}
function sanitizeFilePath(filePath) {
    try {
        const normalizedPath = path.normalize(filePath);
        // Prevent path traversal
        if (normalizedPath.includes('..')) {
            return null;
        }
        // Ensure absolute path
        if (!path.isAbsolute(normalizedPath)) {
            return null;
        }
        // Additional security: only allow specific file extensions
        const allowedExtensions = ['.json'];
        const ext = path.extname(normalizedPath);
        if (!allowedExtensions.includes(ext)) {
            return null;
        }
        return normalizedPath;
    }
    catch {
        return null;
    }
}
// Enhanced error handler
function handleError(error, req, res) {
    console.error('Request error:', {
        url: req.url,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
    });
    // Don't expose internal error details
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
}
// Initialize Express app with security
const app = express();
const server = createServer(app);
// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
}));
// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// CORS with specific origin (in production, replace with actual frontend URL)
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-production-domain.com']
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});
// WebSocket server with enhanced security
const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
        // Basic origin verification for WebSocket connections
        const allowedOrigins = corsOptions.origin;
        const origin = info.origin;
        if (process.env.NODE_ENV === 'production') {
            return allowedOrigins.includes(origin);
        }
        return true; // Allow all origins in development
    }
});
// Secure storage
const projects = new Map();
const fileWatchers = new Map();
const connections = new Set();
// Initialize discovery engine
const discoveryEngine = new ProjectDiscoveryEngine();
// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`WebSocket client connected from ${clientIp}`);
    connections.add(ws);
    // Set up heartbeat to detect broken connections
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);
    ws.on('pong', () => {
        // Connection is alive
    });
    ws.on('close', () => {
        connections.delete(ws);
        clearInterval(heartbeat);
        console.log(`WebSocket client disconnected from ${clientIp}`);
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connections.delete(ws);
        clearInterval(heartbeat);
    });
});
// Secure broadcast function
function broadcastUpdate(projectId, data) {
    const message = JSON.stringify({
        type: 'fileUpdate',
        projectId: projectId,
        data: data,
        timestamp: new Date().toISOString()
    });
    connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
            }
            catch (error) {
                console.error('Error broadcasting to client:', error);
                connections.delete(ws);
            }
        }
    });
}
// Enhanced file watching with security
function watchTasksFile(projectId, filePath) {
    // Validate file path
    const sanitizedPath = sanitizeFilePath(filePath);
    if (!sanitizedPath) {
        throw new Error('Invalid file path');
    }
    // Close existing watcher if any
    if (fileWatchers.has(projectId)) {
        fileWatchers.get(projectId)?.close();
    }
    try {
        const watcher = watch(sanitizedPath, async (eventType) => {
            if (eventType === 'change') {
                try {
                    const content = await readFile(sanitizedPath, 'utf8');
                    // Validate JSON structure
                    let data;
                    try {
                        data = JSON.parse(content);
                    }
                    catch {
                        console.error(`Invalid JSON in file: ${sanitizedPath}`);
                        return;
                    }
                    // Update project data
                    const project = projects.get(projectId);
                    if (project) {
                        projects.set(projectId, {
                            ...project,
                            data,
                            lastUpdated: new Date().toISOString()
                        });
                        // Broadcast to clients
                        broadcastUpdate(projectId, data);
                        console.log(`📊 Updated ${projectId}: ${data.tasks?.length || 0} tasks`);
                    }
                }
                catch (error) {
                    console.error(`Error reading ${sanitizedPath}:`, error);
                }
            }
        });
        fileWatchers.set(projectId, watcher);
    }
    catch (error) {
        throw new Error(`Failed to watch file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
// API Routes with enhanced security
// Add a new project to watch
app.post('/api/projects', validateInput(ProjectSchema), async (req, res) => {
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
        }
        catch {
            res.status(404).json({ error: 'Tasks file not found or not accessible' });
            return;
        }
        // Read and validate initial data
        const content = await readFile(sanitizedTasksPath, 'utf8');
        let data;
        try {
            data = JSON.parse(content);
        }
        catch {
            res.status(400).json({ error: 'Invalid JSON in tasks file' });
            return;
        }
        // Store project info
        const project = {
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
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Get all projects
app.get('/api/projects', (req, res) => {
    try {
        const projectList = Array.from(projects.values()).map(project => ({
            id: project.id,
            name: project.name,
            path: project.path,
            taskCount: project.data?.tasks?.length || 0,
            lastUpdated: project.lastUpdated
        }));
        res.json(projectList);
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Get specific project data
app.get('/api/projects/:id', (req, res) => {
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
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Remove project
app.delete('/api/projects/:id', (req, res) => {
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
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Discovery Routes with enhanced security
// Start auto-discovery
app.post('/api/discovery/start', validateInput(DiscoveryOptionsSchema), async (req, res) => {
    try {
        const options = req.body || {};
        if (discoveryEngine.isScanning()) {
            res.status(409).json({ error: 'Discovery already in progress' });
            return;
        }
        // Set up progress broadcasting with error handling
        discoveryEngine.onProgress((progress) => {
            const message = {
                type: 'discoveryProgress',
                progress
            };
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify(message));
                    }
                    catch (error) {
                        console.error('Error sending progress update:', error);
                        connections.delete(ws);
                    }
                }
            });
        });
        // Start discovery in background
        discoveryEngine.runFullDiscovery(options)
            .then((discoveredProjects) => {
            const message = {
                type: 'discoveryComplete',
                projects: discoveredProjects
            };
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify(message));
                    }
                    catch (error) {
                        console.error('Error sending completion update:', error);
                        connections.delete(ws);
                    }
                }
            });
        })
            .catch((error) => {
            console.error('Discovery failed:', error);
            const message = {
                type: 'discoveryError',
                error: 'Discovery process failed'
            };
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify(message));
                    }
                    catch (error) {
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
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Get discovery status
app.get('/api/discovery/status', (req, res) => {
    try {
        res.json({
            isScanning: discoveryEngine.isScanning(),
            progress: discoveryEngine.getProgress(),
            discoveredCount: discoveryEngine.getDiscoveredProjects().length
        });
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Get discovered projects
app.get('/api/discovery/projects', (req, res) => {
    try {
        const discoveredProjects = discoveryEngine.getDiscoveredProjects();
        res.json(discoveredProjects);
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Auto-add discovered projects
app.post('/api/discovery/add-selected', validateInput(ProjectIdsSchema), async (req, res) => {
    try {
        const { projectIds } = req.body;
        const discoveredProjects = discoveryEngine.getDiscoveredProjects();
        const results = [];
        for (const projectId of projectIds) {
            const discoveredProject = discoveredProjects.find((p) => p.id === projectId);
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
                }
                catch {
                    results.push({ id: projectId, success: false, error: 'Invalid JSON in tasks file' });
                    continue;
                }
                // Add to projects
                const project = {
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
            }
            catch (error) {
                results.push({
                    id: projectId,
                    success: false,
                    error: 'Failed to add project'
                });
            }
        }
        res.json({ results });
    }
    catch (error) {
        handleError(error, req, res);
    }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        projectCount: projects.size,
        connections: connections.size,
        discoveryActive: discoveryEngine.isScanning(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});
// Add Claude Configuration API
addClaudeConfigAPI(app);
// Global error handler
app.use((error, req, res, next) => {
    handleError(error, req, res);
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 TaskMaster File Watcher Server running on http://localhost:${PORT}`);
    console.log(`📁 Watching ${projects.size} projects`);
    console.log(`🔒 Security features enabled: Helmet, CORS, Rate Limiting, Input Validation`);
});
// Enhanced graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    // Close all file watchers
    console.log('📁 Closing file watchers...');
    fileWatchers.forEach((watcher, projectId) => {
        try {
            watcher.close();
            console.log(`  ✓ Closed watcher for project: ${projectId}`);
        }
        catch (error) {
            console.error(`  ✗ Error closing watcher for ${projectId}:`, error);
        }
    });
    // Close WebSocket connections
    console.log('🔌 Closing WebSocket connections...');
    connections.forEach(ws => {
        try {
            ws.close(1000, 'Server shutting down');
        }
        catch (error) {
            console.error('Error closing WebSocket connection:', error);
        }
    });
    // Close WebSocket server
    wss.close(() => {
        console.log('✓ WebSocket server closed');
    });
    // Close HTTP server
    server.close(() => {
        console.log('✓ HTTP server closed');
        console.log('🎯 Graceful shutdown complete');
        process.exit(0);
    });
    // Force close after timeout
    setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
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
//# sourceMappingURL=file-watcher.js.map