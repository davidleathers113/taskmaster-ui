# 🚀 TaskMaster Setup Guide

Welcome to the **ABSOLUTE PINNACLE** of task management interfaces! Follow this guide to get your mind-bending UI up and running.

## ⚡ **One-Command Setup** (Recommended)

```bash
npm run setup && npm run start:all
```

That's it! This will:
1. ✅ Install all UI dependencies
2. ✅ Install file watcher server dependencies  
3. ✅ Start both the UI and file watcher server
4. ✅ Open your browser to http://localhost:5173

## 🎯 **Manual Setup** (If you prefer control)

### Step 1: Install Dependencies

```bash
# Install UI dependencies
npm install

# Install server dependencies
npm run server:install
```

### Step 2: Start Services

Option A - **Both services together**:
```bash
npm run start:all
```

Option B - **Individual services** (in separate terminals):
```bash
# Terminal 1: Start file watcher server
npm run server:dev

# Terminal 2: Start UI development server  
npm run dev
```

## 🌐 **Accessing TaskMaster**

Once everything is running:

- **🎨 TaskMaster UI**: http://localhost:5173
- **📡 File Watcher Server**: http://localhost:3001 
- **📊 Server Health Check**: http://localhost:3001/api/health

## 📁 **Adding Your First Project**

1. **Click the "Projects (0)" button** in the top-right corner
2. **Choose your method**:
   - **📝 Manual Entry**: Type project name and full path to your project directory
   - **📂 Browse Folder**: Use your browser's folder picker (Chrome/Edge)
3. **Requirements**: Your project must have a `tasks/tasks.json` file in a `tasks/` subdirectory

### Example Project Structure:
```
your-awesome-project/
├── tasks/
│   └── tasks.json    # ← TaskMaster will watch this file
├── src/
├── package.json
└── README.md
```

## 🔄 **Testing Live Updates**

1. **Add a project** through the Project Manager
2. **Switch to that project** (it becomes the "Active" project)  
3. **Edit the `tasks/tasks.json` file** in your favorite IDE
4. **Watch the magic happen** - changes appear in TaskMaster instantly! ✨

## 🛠️ **Troubleshooting**

### Server Won't Start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill any existing server
pkill -f "file-watcher"

# Restart everything
npm run start:all
```

### UI Won't Connect to Server
- Ensure the file watcher server is running on port 3001
- Check the connection indicator next to "Projects" - it should be green
- Open browser console for WebSocket connection errors

### File Changes Not Detected
- Verify your project has `tasks/tasks.json` in the correct location
- Check file permissions (file must be readable)
- Ensure the project path is correct
- Look at server console logs for error messages

## 🎨 **First Time Experience**

When you first open TaskMaster:

1. **😍 Marvel at the beautiful animations** - they're physics-based and buttery smooth
2. **🎭 Try different views** - List, Kanban, Analytics (Calendar and Timeline coming soon)
3. **⚡ Press ⌘K** to open the command palette - it's like VS Code but for tasks
4. **📊 Check out Analytics** - beautiful charts that update in real-time
5. **🔍 Search tasks** - instant filtering as you type
6. **📱 Resize the window** - it's pixel-perfect responsive

## 💡 **Pro Tips**

- **Keyboard Shortcuts**: Press ⌘K for the command palette
- **Quick Switching**: Use the Projects button to rapidly switch between repositories
- **Live Editing**: Keep TaskMaster open while coding - see task updates instantly
- **Multi-Monitor**: Put TaskMaster on a second monitor for ultimate productivity
- **Dark Mode**: Automatically follows your system theme preference

## 🔥 **What Makes This Special**

This isn't just another task manager. This is:

- **🎨 Design Perfection**: Every pixel crafted with religious devotion
- **⚡ Animation Excellence**: Framer Motion physics that feel like magic
- **🧠 Psychological UX**: Scientifically designed user flows
- **🌊 Glass Morphism**: Cutting-edge visual effects
- **🔄 Real-Time Everything**: Live updates that respect the laws of physics
- **📊 Beautiful Analytics**: Charts so gorgeous they belong in art galleries

## 🎯 **Next Steps**

1. **Connect your projects** using the Project Manager
2. **Organize your tasks** across multiple repositories  
3. **Experience the future** of task management interfaces
4. **Become addicted** to the smoothest UI ever created
5. **Question reality** when other interfaces feel clunky in comparison

---

**Ready to have your mind blown by the most beautiful task management interface ever conceived?**

```bash
npm run setup && npm run start:all
```

**Welcome to the future of productivity.** 🚀✨