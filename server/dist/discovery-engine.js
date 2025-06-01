import { readdir, stat, access } from 'fs/promises';
import { join, dirname, basename, resolve } from 'path';
import { homedir, platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ProjectDiscoveryEngine {
  constructor() {
    this.discoveredProjects = new Map();
    this.scanningActive = false;
    this.scanProgress = { phase: '', current: 0, total: 0, found: 0 };
    this.callbacks = new Set();
  }

  // Register callback for progress updates
  onProgress(callback) {
    this.callbacks.add(callback);
  }

  // Emit progress to all listeners
  emitProgress(update) {
    this.scanProgress = { ...this.scanProgress, ...update };
    this.callbacks.forEach(cb => cb(this.scanProgress));
  }

  // Get common development directories based on OS
  getCommonDevPaths() {
    const home = homedir();
    const os = platform();
    
    const commonPaths = [
      join(home, 'Projects'),
      join(home, 'Development'),
      join(home, 'Dev'),
      join(home, 'Code'),
      join(home, 'Workspace'),
      join(home, 'workspace'),
      join(home, 'Documents', 'Projects'),
      join(home, 'Documents', 'Development'),
      join(home, 'Documents', 'GitHub'),
      join(home, 'github'),
      join(home, 'GitHub'),
      join(home, 'repos'),
      join(home, 'repositories')
    ];

    // OS-specific paths
    if (os === 'darwin') { // macOS
      commonPaths.push(
        join(home, 'Developer'),
        '/usr/local/src',
        '/opt/projects'
      );
    } else if (os === 'win32') { // Windows
      commonPaths.push(
        'C:\\Projects',
        'C:\\Development',
        'C:\\Code',
        join(home, 'source', 'repos') // Visual Studio default
      );
    } else { // Linux
      commonPaths.push(
        join(home, 'src'),
        '/home/src',
        '/opt/projects',
        '/var/projects'
      );
    }

    return commonPaths;
  }

  // Check if a path exists and is accessible
  async pathExists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  // Find tasks.json in a specific directory
  async findTasksJsonInDir(dirPath, projectName = null) {
    try {
      const tasksDir = join(dirPath, 'tasks');
      const tasksFile = join(tasksDir, 'tasks.json');
      
      if (await this.pathExists(tasksFile)) {
        const stats = await stat(tasksFile);
        const actualProjectName = projectName || basename(dirPath);
        
        return {
          id: `${actualProjectName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name: actualProjectName,
          path: dirPath,
          tasksFile,
          lastModified: stats.mtime,
          discoveryMethod: 'file-scan'
        };
      }
    } catch (error) {
      console.debug(`Error checking ${dirPath}:`, error.message);
    }
    return null;
  }

  // PHASE 1: Quick discovery in common development directories
  async quickDiscovery() {
    this.emitProgress({ phase: 'Quick Discovery - Common Development Directories', current: 0, total: 0 });
    
    const commonPaths = this.getCommonDevPaths();
    const existingPaths = [];
    
    // Filter to only existing paths
    for (const path of commonPaths) {
      if (await this.pathExists(path)) {
        existingPaths.push(path);
      }
    }

    this.emitProgress({ total: existingPaths.length });

    for (let i = 0; i < existingPaths.length; i++) {
      const devPath = existingPaths[i];
      this.emitProgress({ current: i + 1 });

      try {
        const entries = await readdir(devPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const projectPath = join(devPath, entry.name);
            const project = await this.findTasksJsonInDir(projectPath, entry.name);
            
            if (project) {
              this.discoveredProjects.set(project.id, project);
              this.emitProgress({ found: this.discoveredProjects.size });
              console.log(`📁 Found project: ${project.name} at ${project.path}`);
            }
          }
        }
      } catch (error) {
        console.debug(`Error scanning ${devPath}:`, error.message);
      }
    }

    return Array.from(this.discoveredProjects.values());
  }

  // PHASE 2: Git repository discovery
  async gitRepositoryDiscovery() {
    this.emitProgress({ phase: 'Git Repository Discovery', current: 0, total: 0 });

    try {
      // Find all .git directories (indicating git repositories)
      const home = homedir();
      const gitRepos = await this.findGitRepositories(home);
      
      this.emitProgress({ total: gitRepos.length });

      for (let i = 0; i < gitRepos.length; i++) {
        const repoPath = gitRepos[i];
        this.emitProgress({ current: i + 1 });

        const projectName = basename(repoPath);
        const project = await this.findTasksJsonInDir(repoPath, projectName);
        
        if (project && !this.discoveredProjects.has(project.id)) {
          project.discoveryMethod = 'git-scan';
          this.discoveredProjects.set(project.id, project);
          this.emitProgress({ found: this.discoveredProjects.size });
          console.log(`🌿 Found git project: ${project.name} at ${project.path}`);
        }
      }
    } catch (error) {
      console.error('Git discovery failed:', error);
    }

    return Array.from(this.discoveredProjects.values());
  }

  // Find git repositories efficiently
  async findGitRepositories(searchPath, maxDepth = 4, currentDepth = 0) {
    const gitRepos = [];
    
    if (currentDepth >= maxDepth) return gitRepos;

    try {
      const entries = await readdir(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = join(searchPath, entry.name);
        
        // Skip system and cache directories
        if (this.shouldSkipDirectory(entry.name)) continue;
        
        // Check if this is a git repository
        if (entry.name === '.git') {
          gitRepos.push(dirname(fullPath));
          continue;
        }
        
        // Recursively search subdirectories
        try {
          const subRepos = await this.findGitRepositories(fullPath, maxDepth, currentDepth + 1);
          gitRepos.push(...subRepos);
        } catch (error) {
          // Skip directories we can't read
          continue;
        }
      }
    } catch (error) {
      console.debug(`Cannot read directory ${searchPath}:`, error.message);
    }

    return gitRepos;
  }

  // PHASE 3: Smart full system scan (user-initiated)
  async fullSystemDiscovery(options = {}) {
    const { 
      maxDepth = 6, 
      skipHidden = true, 
      skipSystem = true,
      startPaths = null 
    } = options;

    this.emitProgress({ phase: 'Full System Discovery (This may take a while)', current: 0, total: 0 });

    const searchPaths = startPaths || this.getSystemSearchPaths();
    let totalScanned = 0;

    for (const searchPath of searchPaths) {
      if (!(await this.pathExists(searchPath))) continue;
      
      console.log(`🔍 Scanning ${searchPath}...`);
      await this.recursiveFullScan(searchPath, maxDepth, 0, skipHidden, skipSystem);
    }

    return Array.from(this.discoveredProjects.values());
  }

  // Get system-wide search paths
  getSystemSearchPaths() {
    const home = homedir();
    const os = platform();
    
    const paths = [home];
    
    if (os === 'darwin') {
      paths.push('/Users', '/Applications', '/opt');
    } else if (os === 'win32') {
      paths.push('C:\\Users', 'C:\\Program Files', 'D:\\');
    } else {
      paths.push('/home', '/opt', '/usr/local');
    }
    
    return paths;
  }

  // Recursive scan with intelligent filtering
  async recursiveFullScan(dirPath, maxDepth, currentDepth, skipHidden, skipSystem) {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = join(dirPath, entry.name);
        
        // Apply filtering rules
        if (skipHidden && entry.name.startsWith('.') && entry.name !== '.') continue;
        if (skipSystem && this.shouldSkipDirectory(entry.name)) continue;
        
        // Check for tasks.json in this directory
        const project = await this.findTasksJsonInDir(fullPath, entry.name);
        if (project && !this.discoveredProjects.has(project.id)) {
          project.discoveryMethod = 'full-scan';
          this.discoveredProjects.set(project.id, project);
          this.emitProgress({ found: this.discoveredProjects.size });
          console.log(`🔍 Found project: ${project.name} at ${project.path}`);
        }
        
        // Recurse into subdirectory
        await this.recursiveFullScan(fullPath, maxDepth, currentDepth + 1, skipHidden, skipSystem);
      }
    } catch (error) {
      // Skip directories we can't read
      return;
    }
  }

  // Determine if a directory should be skipped for performance/relevance
  shouldSkipDirectory(dirName) {
    const skipPatterns = [
      // System directories
      'System Volume Information', 'Windows', 'Program Files', 'Program Files (x86)',
      'Applications', 'System', 'Library', 'usr', 'var', 'tmp', 'temp',
      
      // Development artifacts
      'node_modules', '.git', '.svn', '.hg', 'vendor', 'venv', 'env',
      'target', 'build', 'dist', 'out', '.gradle', '.maven',
      
      // Cache and temporary
      '.cache', '.tmp', 'Cache', 'Caches', 'Temporary Items',
      '.npm', '.yarn', '.pnpm', '__pycache__',
      
      // OS specific
      '.Trash', '$RECYCLE.BIN', 'Recycler', '.DS_Store',
      'Thumbs.db', 'desktop.ini'
    ];
    
    return skipPatterns.some(pattern => 
      dirName === pattern || 
      dirName.toLowerCase() === pattern.toLowerCase() ||
      dirName.includes(pattern)
    );
  }

  // Run all discovery phases
  async runFullDiscovery(options = {}) {
    if (this.scanningActive) {
      throw new Error('Discovery already in progress');
    }

    this.scanningActive = true;
    this.discoveredProjects.clear();

    try {
      // Phase 1: Quick discovery
      console.log('🚀 Starting Phase 1: Quick Discovery');
      await this.quickDiscovery();

      // Phase 2: Git repository discovery
      if (options.includeGitScan !== false) {
        console.log('🌿 Starting Phase 2: Git Repository Discovery');
        await this.gitRepositoryDiscovery();
      }

      // Phase 3: Full system scan (optional, user-initiated)
      if (options.includeFullScan === true) {
        console.log('🔍 Starting Phase 3: Full System Discovery');
        await this.fullSystemDiscovery(options.fullScanOptions);
      }

      this.emitProgress({ phase: 'Discovery Complete', current: 1, total: 1 });
      console.log(`✅ Discovery complete! Found ${this.discoveredProjects.size} projects`);

      return Array.from(this.discoveredProjects.values());
    } finally {
      this.scanningActive = false;
    }
  }

  // Get current discovery results
  getDiscoveredProjects() {
    return Array.from(this.discoveredProjects.values());
  }

  // Check if discovery is currently running
  isScanning() {
    return this.scanningActive;
  }

  // Get current scan progress
  getProgress() {
    return this.scanProgress;
  }
}