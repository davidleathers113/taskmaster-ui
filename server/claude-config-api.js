import fs from 'fs'
// import path from 'path' // Not used

// Add Claude config API endpoint to the existing file watcher server
export function addClaudeConfigAPI(app) {
  // API endpoint to read Claude configuration
  app.post('/api/claude-config', async (req, res) => {
    try {
      const { configPath } = req.body
      const filePath = configPath || '/Users/davidleathers/.claude.json'
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          error: 'Claude configuration file not found',
          path: filePath 
        })
      }

      // Get file stats
      const stats = fs.statSync(filePath)
      const fileSizeInBytes = stats.size
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2)
      
      // Read and parse the file
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const config = JSON.parse(fileContent)
      
      res.json({
        config,
        lastModified: stats.mtime.toISOString(),
        fileSize: `${fileSizeInMB} MB`,
        fileSizeBytes: fileSizeInBytes
      })
      
    } catch (error) {
      console.error('Error reading Claude config:', error)
      
      if (error instanceof SyntaxError) {
        res.status(400).json({ 
          error: 'Invalid JSON in Claude configuration file',
          details: error.message 
        })
      } else {
        res.status(500).json({ 
          error: 'Failed to read Claude configuration',
          details: error.message 
        })
      }
    }
  })

  // API endpoint to get config file info without parsing (for large files)
  app.get('/api/claude-config/info', async (req, res) => {
    try {
      const configPath = req.query.path || '/Users/davidleathers/.claude.json'
      
      if (!fs.existsSync(configPath)) {
        return res.status(404).json({ 
          error: 'Claude configuration file not found',
          path: configPath 
        })
      }

      const stats = fs.statSync(configPath)
      const fileSizeInBytes = stats.size
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2)
      
      res.json({
        path: configPath,
        lastModified: stats.mtime.toISOString(),
        fileSize: `${fileSizeInMB} MB`,
        fileSizeBytes: fileSizeInBytes,
        exists: true
      })
      
    } catch (error) {
      console.error('Error getting Claude config info:', error)
      res.status(500).json({ 
        error: 'Failed to get Claude configuration info',
        details: error.message 
      })
    }
  })
}