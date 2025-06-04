import { Request, Response, Application } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
// Removed unused import
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Branded types for enhanced type safety
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;

export type SafeFilePath = Branded<string, 'SafeFilePath'>;
export type ClaudeConfigData = Branded<object, 'ClaudeConfigData'>;

// Validation schemas using Zod
const ConfigPathSchema = z.object({
  configPath: z.string()
    .min(1, 'Config path cannot be empty')
    .max(500, 'Config path too long')
    .refine(
      (path) => {
        // Allowlist validation: Only allow specific safe paths
        const allowedPaths = [
          '/Users/davidleathers/.claude.json',
          // Add other explicitly allowed paths here
        ];
        return allowedPaths.some(allowedPath => path === allowedPath);
      },
      {
        message: 'Access to this file path is not permitted'
      }
    )
    .transform((path): SafeFilePath => path as SafeFilePath)
});

const ConfigInfoQuerySchema = z.object({
  path: z.string()
    .optional()
    .transform((path): SafeFilePath | undefined => 
      path ? ConfigPathSchema.parse({ configPath: path }).configPath : undefined
    )
});

// Security middleware configuration
const claudeConfigRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generic validation middleware
function validateRequest<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: Function): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        
        res.status(400).json({
          error: 'Validation failed',
          details: errorMessages
        });
        return;
      }
      
      // Log the error for monitoring but don't expose details
      console.error('Validation error:', error);
      res.status(500).json({
        error: 'Internal server error during validation'
      });
      return;
    }
  };
}

// Sanitize and validate file path
function sanitizeFilePath(inputPath: string): SafeFilePath {
  try {
    const result = ConfigPathSchema.parse({ configPath: inputPath });
    return result.configPath;
  } catch {
    throw new Error('Invalid or unauthorized file path');
  }
}

// Secure file operations with proper error handling
async function readConfigFile(filePath: SafeFilePath): Promise<{
  config: ClaudeConfigData;
  stats: {
    lastModified: string;
    fileSize: string;
    fileSizeBytes: number;
  };
}> {
  try {
    // Check if file exists and get stats
    const stats = await fs.stat(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
    
    // Read file content with size limit (prevent DoS)
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    if (fileSizeInBytes > maxFileSize) {
      throw new Error('File size exceeds maximum allowed limit');
    }
    
    const fileContent = await fs.readFile(filePath, 'utf8');
    
    // Parse JSON with error handling
    let config: object;
    try {
      config = JSON.parse(fileContent);
    } catch {
      throw new Error('Invalid JSON format in configuration file');
    }
    
    return {
      config: config as ClaudeConfigData,
      stats: {
        lastModified: stats.mtime.toISOString(),
        fileSize: `${fileSizeInMB} MB`,
        fileSizeBytes: fileSizeInBytes
      }
    };
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw known errors
      throw error;
    }
    // Handle unknown errors
    throw new Error('Failed to read configuration file');
  }
}

// Enhanced error response without information disclosure
function sendErrorResponse(res: Response, statusCode: number, message: string, logError?: unknown) {
  if (logError) {
    console.error('API Error:', logError);
  }
  
  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString()
  });
}

// Add Claude config API endpoints to the existing Express app
export function addClaudeConfigAPI(app: Application): void {
  // Apply security middleware
  app.use('/api/claude-config', helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  app.use('/api/claude-config', claudeConfigRateLimit);
  
  // POST /api/claude-config - Read Claude configuration with validation
  app.post('/api/claude-config', 
    validateRequest(ConfigPathSchema),
    async (req: Request, res: Response) => {
      try {
        const { configPath } = req.body;
        const safeFilePath = sanitizeFilePath(configPath);
        
        const result = await readConfigFile(safeFilePath);
        
        res.json({
          config: result.config,
          lastModified: result.stats.lastModified,
          fileSize: result.stats.fileSize,
          fileSizeBytes: result.stats.fileSizeBytes,
          success: true
        });
        
      } catch (error) {
        if (error instanceof Error) {
          switch (error.message) {
            case 'Invalid or unauthorized file path':
              sendErrorResponse(res, 403, 'Access denied to specified file path', error);
              break;
            case 'File size exceeds maximum allowed limit':
              sendErrorResponse(res, 413, 'File too large to process', error);
              break;
            case 'Invalid JSON format in configuration file':
              sendErrorResponse(res, 400, 'Configuration file contains invalid JSON', error);
              break;
            default:
              if (error.message.includes('ENOENT')) {
                sendErrorResponse(res, 404, 'Configuration file not found', error);
              } else if (error.message.includes('EACCES')) {
                sendErrorResponse(res, 403, 'Permission denied accessing configuration file', error);
              } else {
                sendErrorResponse(res, 500, 'Failed to read configuration file', error);
              }
              break;
          }
        } else {
          sendErrorResponse(res, 500, 'Internal server error', error);
        }
      }
    }
  );
  
  // GET /api/claude-config/info - Get file info without reading content
  app.get('/api/claude-config/info', async (req: Request, res: Response): Promise<void> => {
    try {
      const queryValidation = ConfigInfoQuerySchema.parse(req.query);
      const configPath = queryValidation.path || '/Users/davidleathers/.claude.json' as SafeFilePath;
      const safeFilePath = sanitizeFilePath(configPath);
      
      const stats = await fs.stat(safeFilePath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
      
      res.json({
        path: safeFilePath,
        lastModified: stats.mtime.toISOString(),
        fileSize: `${fileSizeInMB} MB`,
        fileSizeBytes: fileSizeInBytes,
        exists: true,
        success: true
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        
        res.status(400).json({
          error: 'Invalid query parameters',
          details: errorMessages
        });
        return;
      }
      
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          sendErrorResponse(res, 404, 'Configuration file not found', error);
        } else if (error.message.includes('EACCES')) {
          sendErrorResponse(res, 403, 'Permission denied accessing configuration file', error);
        } else if (error.message === 'Invalid or unauthorized file path') {
          sendErrorResponse(res, 403, 'Access denied to specified file path', error);
        } else {
          sendErrorResponse(res, 500, 'Failed to get configuration file info', error);
        }
      } else {
        sendErrorResponse(res, 500, 'Internal server error', error);
      }
    }
  });
  
  // Health check endpoint
  app.get('/api/claude-config/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  });
}

export default addClaudeConfigAPI;