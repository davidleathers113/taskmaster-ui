import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Zap, 
  Layers, 
  Settings,
  Play,
  CheckCircle2,
  Folder,
  GitBranch,
  HardDrive,
  Clock,
  AlertTriangle,
  Download,
  Sparkles,
  Target,
  FileText
} from 'lucide-react'
import { useProjectDiscovery } from '@/hooks/useProjectDiscovery'
import { cn, formatDate } from '@/lib/utils'

interface ProjectDiscoveryProps {
  onClose: () => void
  onProjectsAdded: () => void
}

export function ProjectDiscovery({ onClose, onProjectsAdded }: ProjectDiscoveryProps) {
  const [selectedPreset, setSelectedPreset] = useState<'quick' | 'deep' | 'custom'>('quick')
  const [customOptions, setCustomOptions] = useState({
    includeGitScan: true,
    includeFullScan: false,
    maxDepth: 6,
    skipHidden: true,
    skipSystem: true
  })

  const {
    discoveredProjects,
    isDiscovering,
    progress,
    selectedProjects,
    error,
    quickDiscovery,
    deepDiscovery,
    customDiscovery,
    addSelectedProjects,
    toggleProjectSelection,
    selectAllProjects,
    deselectAllProjects,
    selectedCount,
    totalDiscovered,
    canAddProjects
  } = useProjectDiscovery()

  const presets = [
    {
      id: 'quick',
      name: 'Quick Discovery',
      description: 'Scan common development directories and git repositories',
      icon: Zap,
      color: 'from-emerald-500 to-teal-600',
      duration: '30 seconds',
      action: quickDiscovery
    },
    {
      id: 'deep',
      name: 'Deep Discovery',
      description: 'Comprehensive system scan (may take several minutes)',
      icon: Layers,
      color: 'from-blue-500 to-indigo-600',
      duration: '2-5 minutes',
      action: deepDiscovery
    },
    {
      id: 'custom',
      name: 'Custom Discovery',
      description: 'Configure your own discovery parameters',
      icon: Settings,
      color: 'from-purple-500 to-pink-600',
      duration: 'Variable',
      action: () => customDiscovery(customOptions)
    }
  ]

  const handleStartDiscovery = async () => {
    const preset = presets.find(p => p.id === selectedPreset)
    if (preset) {
      const result = await preset.action()
      if (!result.success) {
        alert(`Discovery failed: ${result.error}`)
      }
    }
  }

  const handleAddProjects = async () => {
    const result = await addSelectedProjects()
    if (result.success) {
      onProjectsAdded()
      if (result.added > 0) {
        alert(`Successfully added ${result.added} projects!`)
      }
      if (result.failed > 0) {
        alert(`Warning: ${result.failed} projects failed to add. Check console for details.`)
      }
    } else {
      alert(`Failed to add projects: ${result.error}`)
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'git-scan': return GitBranch
      case 'full-scan': return HardDrive
      default: return Folder
    }
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'git-scan': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20'
      case 'full-scan': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20'
      default: return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-6xl bg-card border border-border/50 rounded-2xl shadow-2xl glass-morphism overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold gradient-text">Project Auto-Discovery</h2>
                <p className="text-muted-foreground">
                  Automatically find all TaskMaster projects on your computer
                </p>
              </div>
            </div>
            
            <motion.button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ✕
            </motion.button>
          </div>
        </div>

        <div className="flex h-[600px]">
          {/* Left Panel - Discovery Options */}
          <div className="w-1/3 p-6 border-r border-border/50">
            <h3 className="font-semibold mb-4 flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Discovery Modes</span>
            </h3>
            
            <div className="space-y-3">
              {presets.map((preset) => (
                <motion.div
                  key={preset.id}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                    selectedPreset === preset.id
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-border/50 hover:border-primary/50"
                  )}
                  onClick={() => setSelectedPreset(preset.id as any)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start space-x-3">
                    <div className={cn(
                      "p-2 rounded-lg bg-gradient-to-br",
                      preset.color,
                      "text-white flex-shrink-0"
                    )}>
                      <preset.icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium mb-1">{preset.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {preset.description}
                      </p>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>~{preset.duration}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Custom Options */}
            <AnimatePresence>
              {selectedPreset === 'custom' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 p-4 bg-muted/20 rounded-lg overflow-hidden"
                >
                  <h4 className="font-medium mb-3">Custom Options</h4>
                  <div className="space-y-3 text-sm">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customOptions.includeGitScan}
                        onChange={(e) => setCustomOptions(prev => ({
                          ...prev,
                          includeGitScan: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span>Scan Git repositories</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customOptions.includeFullScan}
                        onChange={(e) => setCustomOptions(prev => ({
                          ...prev,
                          includeFullScan: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span>Full system scan</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customOptions.skipSystem}
                        onChange={(e) => setCustomOptions(prev => ({
                          ...prev,
                          skipSystem: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span>Skip system directories</span>
                    </label>
                    
                    <div className="flex items-center space-x-2">
                      <span>Max depth:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={customOptions.maxDepth}
                        onChange={(e) => setCustomOptions(prev => ({
                          ...prev,
                          maxDepth: parseInt(e.target.value) || 6
                        }))}
                        className="w-16 px-2 py-1 rounded border border-border/50"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start Discovery Button */}
            <motion.button
              onClick={handleStartDiscovery}
              disabled={isDiscovering}
              className={cn(
                "w-full mt-6 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl",
                "font-medium transition-all duration-200",
                isDiscovering
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl"
              )}
              whileHover={!isDiscovering ? { scale: 1.02 } : {}}
              whileTap={!isDiscovering ? { scale: 0.98 } : {}}
            >
              {isDiscovering ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  />
                  <span>Discovering...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start Discovery</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Right Panel - Results */}
          <div className="flex-1 flex flex-col">
            {/* Progress Bar */}
            <AnimatePresence>
              {isDiscovering && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 border-b border-border/50 bg-blue-50/50 dark:bg-blue-950/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{progress.phase}</span>
                    <span className="text-sm text-muted-foreground">
                      {progress.current}/{progress.total} • {progress.found} found
                    </span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' 
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 border-b border-border/50 bg-red-50/50 dark:bg-red-950/20"
                >
                  <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Discovery Error</span>
                  </div>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results Header */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="font-semibold">Discovered Projects</h3>
                  {totalDiscovered > 0 && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm">
                      {totalDiscovered} found
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {totalDiscovered > 0 && (
                    <>
                      <motion.button
                        onClick={selectAllProjects}
                        className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Select All
                      </motion.button>
                      <span className="text-muted-foreground">•</span>
                      <motion.button
                        onClick={deselectAllProjects}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Deselect All
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto">
              {totalDiscovered === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    {isDiscovering ? (
                      <>
                        <Sparkles className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-pulse" />
                        <h3 className="text-lg font-semibold mb-2">Scanning for projects...</h3>
                        <p className="text-muted-foreground">
                          {progress.phase || 'Searching your computer for TaskMaster projects'}
                        </p>
                      </>
                    ) : (
                      <>
                        <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">Ready to discover</h3>
                        <p className="text-muted-foreground">
                          Choose a discovery mode and click "Start Discovery" to find your projects
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {discoveredProjects.map((project, index) => {
                    const MethodIcon = getMethodIcon(project.discoveryMethod)
                    const isSelected = selectedProjects.has(project.id)
                    
                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "p-4 rounded-xl border cursor-pointer transition-all duration-200",
                          "hover:border-primary/50 hover:shadow-md",
                          isSelected 
                            ? "border-primary bg-primary/5 shadow-lg" 
                            : "border-border/50"
                        )}
                        onClick={() => toggleProjectSelection(project.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1 min-w-0">
                            <motion.div
                              className={cn(
                                "mt-1 w-5 h-5 rounded border-2 flex items-center justify-center",
                                isSelected 
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground"
                              )}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </motion.div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <h4 className="font-medium truncate">{project.name}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground truncate mb-2">
                                {project.path}
                              </p>
                              <div className="flex items-center space-x-3 text-xs">
                                <div className={cn(
                                  "flex items-center space-x-1 px-2 py-1 rounded-full",
                                  getMethodColor(project.discoveryMethod)
                                )}>
                                  <MethodIcon className="w-3 h-3" />
                                  <span className="capitalize">
                                    {project.discoveryMethod.replace('-', ' ')}
                                  </span>
                                </div>
                                <span className="text-muted-foreground">
                                  Modified: {formatDate(project.lastModified)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {totalDiscovered > 0 && (
              <div className="p-4 border-t border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedCount} of {totalDiscovered} projects selected
                  </div>
                  
                  <motion.button
                    onClick={handleAddProjects}
                    disabled={!canAddProjects}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all",
                      canAddProjects
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                    whileHover={canAddProjects ? { scale: 1.02 } : {}}
                    whileTap={canAddProjects ? { scale: 0.98 } : {}}
                  >
                    <Download className="w-4 h-4" />
                    <span>Add Selected Projects</span>
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}