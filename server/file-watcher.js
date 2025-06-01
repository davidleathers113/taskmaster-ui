import express from 'express';
import { watch } from 'fs';
import { readFile, access } from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { ProjectDiscoveryEngine } from './discovery-engine.js';
import { addClaudeConfigAPI } from './claude-config-api.ts';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Store project configurations
const projects = new Map();
const fileWatchers = new Map();

// WebSocket connections for live updates
const connections = new Set();

// Initialize discovery engine
const discoveryEngine = new ProjectDiscoveryEngine();

wss.on('connection', (ws) => {
  connections.add(ws);
  console.log('Client connected');
  
  ws.on('close', () => {
    connections.delete(ws);
    console.log('Client disconnected');
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate(projectId, data) {
  const message = JSON.stringify({
    type: 'fileUpdate',
    projectId,
    data
  });
  
  connections.forEach(ws => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(message);
    }
  });
}

// Watch a tasks.json file for changes
function watchTasksFile(projectId, filePath) {
  if (fileWatchers.has(projectId)) {
    fileWatchers.get(projectId).close();
  }
  
  const watcher = watch(filePath, async (eventType) => {
    if (eventType === 'change') {
      try {
        const content = await readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Update project data
        projects.set(projectId, {
          ...projects.get(projectId),
          data,
          lastUpdated: new Date().toISOString()
        });
        
        // Broadcast to all clients
        broadcastUpdate(projectId, data);
        console.log(`📊 Updated ${projectId}: ${data.tasks?.length || 0} tasks`);
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
      }
    }
  });
  
  fileWatchers.set(projectId, watcher);
}

// API Routes

// Add a new project to watch
app.post('/api/projects', async (req, res) => {
  const { id, name, path: projectPath } = req.body;
  
  const tasksFilePath = path.join(projectPath, 'tasks', 'tasks.json');
  
  try {
    // Check if tasks.json exists
    await access(tasksFilePath);
    
    // Read initial data
    const content = await readFile(tasksFilePath, 'utf8');
    const data = JSON.parse(content);
    
    // Store project info
    projects.set(id, {
      id,
      name,
      path: projectPath,
      tasksFilePath,
      data,
      lastUpdated: new Date().toISOString()
    });
    
    // Start watching
    watchTasksFile(id, tasksFilePath);
    
    res.json({ success: true, project: projects.get(id) });
  } catch (error) {
    res.status(400).json({ error: `Failed to add project: ${error.message}` });
  }
});

// Get all projects
app.get('/api/projects', (req, res) => {
  const projectList = Array.from(projects.values()).map(project => ({
    id: project.id,
    name: project.name,
    path: project.path,
    taskCount: project.data?.tasks?.length || 0,
    lastUpdated: project.lastUpdated
  }));
  
  res.json(projectList);
});

// Get specific project data
app.get('/api/projects/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Remove project
app.delete('/api/projects/:id', (req, res) => {
  const projectId = req.params.id;
  
  if (fileWatchers.has(projectId)) {
    fileWatchers.get(projectId).close();
    fileWatchers.delete(projectId);
  }
  
  projects.delete(projectId);
  res.json({ success: true });
});

// Discovery Routes

// Start auto-discovery
app.post('/api/discovery/start', async (req, res) => {
  try {
    const options = req.body || {};
    
    if (discoveryEngine.isScanning()) {
      return res.status(409).json({ error: 'Discovery already in progress' });
    }

    // Set up progress broadcasting
    discoveryEngine.onProgress((progress) => {
      const message = JSON.stringify({
        type: 'discoveryProgress',
        progress
      });
      
      connections.forEach(ws => {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      });
    });

    // Start discovery in background
    discoveryEngine.runFullDiscovery(options)
      .then(discoveredProjects => {
        // Broadcast completion
        const message = JSON.stringify({
          type: 'discoveryComplete',
          projects: discoveredProjects
        });
        
        connections.forEach(ws => {
          if (ws.readyState === 1) {
            ws.send(message);
          }
        });
      })
      .catch(error => {
        console.error('Discovery failed:', error);
        
        const message = JSON.stringify({
          type: 'discoveryError',
          error: error.message
        });
        
        connections.forEach(ws => {
          if (ws.readyState === 1) {
            ws.send(message);
          }
        });
      });

    res.json({ 
      success: true, 
      message: 'Discovery started',
      progress: discoveryEngine.getProgress()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get discovery status
app.get('/api/discovery/status', (req, res) => {
  res.json({
    isScanning: discoveryEngine.isScanning(),
    progress: discoveryEngine.getProgress(),
    discoveredCount: discoveryEngine.getDiscoveredProjects().length
  });
});

// Get discovered projects
app.get('/api/discovery/projects', (req, res) => {
  const discoveredProjects = discoveryEngine.getDiscoveredProjects();
  res.json(discoveredProjects);
});

// Auto-add discovered projects
app.post('/api/discovery/add-selected', async (req, res) => {
  try {
    const { projectIds } = req.body;
    
    if (!Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'projectIds must be an array' });
    }

    const discoveredProjects = discoveryEngine.getDiscoveredProjects();
    const results = [];

    for (const projectId of projectIds) {
      const discoveredProject = discoveredProjects.find(p => p.id === projectId);
      
      if (!discoveredProject) {
        results.push({ id: projectId, success: false, error: 'Project not found' });
        continue;
      }

      try {
        // Check if tasks.json exists and is readable
        const content = await readFile(discoveredProject.tasksFile, 'utf8');
        const data = JSON.parse(content);
        
        // Add to projects
        projects.set(discoveredProject.id, {
          ...discoveredProject,
          data,
          lastUpdated: new Date().toISOString()
        });
        
        // Start watching
        watchTasksFile(discoveredProject.id, discoveredProject.tasksFile);
        
        results.push({ id: projectId, success: true });
        console.log(`📊 Auto-added project: ${discoveredProject.name}`);
      } catch (error) {
        results.push({ 
          id: projectId, 
          success: false, 
          error: `Failed to add project: ${error.message}` 
        });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    projectCount: projects.size,
    connections: connections.size,
    discoveryActive: discoveryEngine.isScanning()
  });
});

// Add Claude Configuration API
addClaudeConfigAPI(app);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 TaskMaster File Watcher Server running on http://localhost:${PORT}`);
  console.log(`📁 Watching ${projects.size} projects`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  // Close all file watchers
  fileWatchers.forEach(watcher => watcher.close());
  
  // Close WebSocket server
  wss.close();
  
  process.exit(0);
});