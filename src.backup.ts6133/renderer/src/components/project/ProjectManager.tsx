import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FolderOpen, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  CheckCircle2,
  Clock,
  AlertCircle,
  Folder,
  FileText,
  Search,
  Sparkles
} from 'lucide-react'
import { useProjectManager } from '@/hooks/useProjectManager'
import { ProjectDiscovery } from '@/components/project/ProjectDiscovery'
import { cn } from '@/lib/utils'

export function ProjectManager() {
  const [isOpen, setIsOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectPath, setNewProjectPath] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDiscovery, setShowDiscovery] = useState(false)
  
  const {
    projects,
    activeProject,
    isConnected,
    isLoading,
    addProject,
    removeProject,
    switchToProject,
    addProjectWithFilePicker,
    loadProjects
  } = useProjectManager()

  const handleAddProject = async () => {
    if (!newProjectName.trim() || !newProjectPath.trim()) return
    
    const result = await addProject(newProjectName.trim(), newProjectPath.trim())
    if (result.success) {
      setNewProjectName('')
      setNewProjectPath('')
      setShowAddForm(false)
    } else {
      alert(`Failed to add project: ${result.error}`)
    }
  }

  const handleAddWithFilePicker = async () => {
    const result = await addProjectWithFilePicker()
    if (!result.success && result.error !== 'User cancelled file selection') {
      alert(`Failed to add project: ${result.error}`)
    }
  }

  const handleSwitchProject = async (projectId: string) => {
    const result = await switchToProject(projectId)
    if (!result.success) {
      alert(`Failed to switch project: ${result.error}`)
    }
  }

  const handleRemoveProject = async (projectId: string, projectName: string) => {
    if (confirm(`Remove project "${projectName}"?`)) {
      const result = await removeProject(projectId)
      if (!result.success) {
        alert(`Failed to remove project: ${result.error}`)
      }
    }
  }

  return (
    <>
      {/* Project Manager Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed top-4 right-4 z-40 flex items-center space-x-2 px-4 py-2 rounded-xl",
          "bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium",
          "hover:from-emerald-600 hover:to-teal-700 transition-all duration-200",
          "shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <FolderOpen className="w-5 h-5" />
        <span>Projects ({projects.length})</span>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isConnected ? "bg-green-300 animate-pulse" : "bg-red-300"
        )} />
      </motion.button>

      {/* Project Manager Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-4xl bg-card border border-border/50 rounded-2xl shadow-2xl glass-morphism overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FolderOpen className="w-6 h-6" />
                    <h2 className="text-2xl font-bold gradient-text">Project Manager</h2>
                    <div className={cn(
                      "flex items-center space-x-2 px-3 py-1 rounded-full text-sm",
                      isConnected 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    )}>
                      {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <motion.button
                      onClick={loadProjects}
                      disabled={isLoading}
                      className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setShowDiscovery(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Search className="w-4 h-4" />
                      <span>Auto-Discover</span>
                      <Sparkles className="w-3 h-3" />
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Manually</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Add Project Form */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-border/50 overflow-hidden"
                  >
                    <div className="p-6 bg-muted/20">
                      <h3 className="font-semibold mb-4">Add New Project</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Project Name</label>
                          <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="My Awesome Project"
                            className="w-full px-3 py-2 rounded-lg border border-border/50 bg-background/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Project Path</label>
                          <input
                            type="text"
                            value={newProjectPath}
                            onChange={(e) => setNewProjectPath(e.target.value)}
                            placeholder="/Users/username/my-project"
                            className="w-full px-3 py-2 rounded-lg border border-border/50 bg-background/50"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 mt-4">
                        <motion.button
                          onClick={handleAddProject}
                          disabled={!newProjectName.trim() || !newProjectPath.trim() || isLoading}
                          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Add Project</span>
                        </motion.button>
                        
                        <motion.button
                          onClick={handleAddWithFilePicker}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Folder className="w-4 h-4" />
                          <span>Browse Folder</span>
                        </motion.button>
                        
                        <motion.button
                          onClick={() => setShowAddForm(false)}
                          className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Projects List */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add your first project to start tracking tasks across multiple repositories
                    </p>
                    <div className="flex items-center space-x-3 justify-center">
                      <motion.button
                        onClick={() => setShowDiscovery(true)}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Search className="w-4 h-4" />
                        <span>Auto-Discover Projects</span>
                        <Sparkles className="w-3 h-3" />
                      </motion.button>
                      
                      <span className="text-muted-foreground">or</span>
                      
                      <motion.button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Manually</span>
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                          "hover:border-primary/50 hover:shadow-lg",
                          project.id === activeProject 
                            ? "border-primary bg-primary/5 shadow-lg" 
                            : "border-border/50 bg-background/50"
                        )}
                        onClick={() => handleSwitchProject(project.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              project.id === activeProject 
                                ? "bg-primary/20 text-primary" 
                                : "bg-muted/50 text-muted-foreground"
                            )}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{project.name}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {project.path}
                              </p>
                            </div>
                          </div>
                          
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveProject(project.id, project.name)
                            }}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </motion.button>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{project.taskCount} tasks</span>
                            </div>
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(project.lastUpdated).toLocaleTimeString()}</span>
                            </div>
                          </div>
                          
                          {project.id === activeProject && (
                            <div className="flex items-center space-x-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              <span className="text-xs font-medium">Active</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border/50 bg-muted/20">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <span>{projects.length} projects configured</span>
                    {activeProject && (
                      <span>Active: {projects.find(p => p.id === activeProject)?.name}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!isConnected && (
                      <div className="flex items-center space-x-2 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Server disconnected - start file watcher</span>
                      </div>
                    )}
                    
                    <motion.button
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Discovery Modal */}
      <AnimatePresence>
        {showDiscovery && (
          <ProjectDiscovery 
            onClose={() => setShowDiscovery(false)}
            onProjectsAdded={() => {
              setShowDiscovery(false)
              loadProjects()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}