# TaskMaster File Watcher Server

This server enables **LIVE MONITORING** of your tasks.json files across multiple projects. It watches for file changes and provides real-time updates to your TaskMaster UI.

## 🚀 Features

- **📁 Multi-Project Support**: Watch multiple project directories simultaneously
- **⚡ Real-Time Updates**: WebSocket connections for instant file change notifications
- **🔄 Auto-Refresh**: UI automatically updates when tasks.json files change
- **🛡️ Error Handling**: Robust error handling and connection management
- **📊 Live Statistics**: Track project count, task counts, and connection status

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on **http://localhost:3001**

### 3. Add Your Projects

Use the Project Manager in the TaskMaster UI to add your project directories. The server will automatically:

- Detect `tasks/tasks.json` files in your project directories
- Start watching for file changes
- Send live updates to all connected clients

## 📡 API Endpoints

### Projects Management

```bash
# Get all projects
GET /api/projects

# Add a new project
POST /api/projects
{
  "id": "my-project-123",
  "name": "My Awesome Project", 
  "path": "/Users/username/my-project"
}

# Get specific project
GET /api/projects/:id

# Remove project
DELETE /api/projects/:id

# Health check
GET /api/health
```

### WebSocket Events

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3001')

// Listen for file updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.type === 'fileUpdate') {
    console.log('Project updated:', message.projectId)
    console.log('New data:', message.data)
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
PORT=3001  # Server port (default: 3001)
```

### File Structure Requirements

Your projects should have the following structure:

```
your-project/
├── tasks/
│   └── tasks.json    # ← This file is watched
├── src/
└── package.json
```

## 🎯 Usage with TaskMaster UI

1. **Start the File Watcher Server** (this server)
2. **Open TaskMaster UI** in your browser
3. **Click the "Projects" button** in the top-right corner
4. **Add your project directories** using either:
   - Manual path entry
   - Browser directory picker (modern browsers)
5. **Switch between projects** to view their task statuses
6. **Edit tasks.json files** in your IDE - changes appear instantly!

## 🔍 Monitoring

The server provides real-time monitoring:

- **📊 Dashboard**: Health endpoint shows project count and connections
- **🔗 WebSocket Status**: Connection indicator in the UI
- **📝 Console Logs**: Detailed logging of file changes and client connections

## 🛡️ Security Notes

- Server runs locally on your machine
- No external network access required
- Files never leave your local system
- WebSocket connections are local-only

## 🚨 Troubleshooting

### Server Won't Start
```bash
# Check if port 3001 is available
lsof -i :3001

# Kill any existing process
pkill -f "node.*file-watcher"
```

### Files Not Updating
- Ensure `tasks/tasks.json` exists in your project directory
- Check file permissions (readable by Node.js)
- Verify the project path is correct
- Check server console for error messages

### WebSocket Connection Issues
- Ensure server is running on localhost:3001
- Check browser console for connection errors
- Verify firewall settings allow localhost connections

## 🎨 Integration with IDEs

This server works seamlessly with any IDE or text editor:

- **VS Code**: Edit tasks.json → instant UI update
- **Vim/Neovim**: Save changes → real-time sync
- **JetBrains IDEs**: File modifications → live preview
- **Sublime Text**: Auto-save → immediate reflection

## ⚡ Performance

- **Minimal CPU Usage**: Only processes file change events
- **Low Memory Footprint**: Efficient file watching
- **Fast Updates**: Sub-second change detection
- **Scalable**: Handles dozens of projects simultaneously

---

*Built with ❤️ for the ultimate task management experience*