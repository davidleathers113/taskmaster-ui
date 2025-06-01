import { useState, useEffect, useCallback } from 'react'

interface DiscoveredProject {
  id: string
  name: string
  path: string
  tasksFile: string
  lastModified: string
  discoveryMethod: 'file-scan' | 'git-scan' | 'full-scan'
}

interface DiscoveryProgress {
  phase: string
  current: number
  total: number
  found: number
}

interface DiscoveryOptions {
  includeGitScan?: boolean
  includeFullScan?: boolean
  fullScanOptions?: {
    maxDepth?: number
    skipHidden?: boolean
    skipSystem?: boolean
    startPaths?: string[]
  }
}

const SERVER_URL = 'http://localhost:3001'

export function useProjectDiscovery() {
  const [discoveredProjects, setDiscoveredProjects] = useState<DiscoveredProject[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [progress, setProgress] = useState<DiscoveryProgress>({
    phase: '',
    current: 0,
    total: 0,
    found: 0
  })
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // WebSocket connection for discovery updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001`)
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        switch (message.type) {
          case 'discoveryProgress':
            setProgress(message.progress)
            break
            
          case 'discoveryComplete':
            setDiscoveredProjects(message.projects)
            setIsDiscovering(false)
            setProgress(prev => ({ ...prev, phase: 'Discovery Complete!' }))
            console.log(`🎉 Discovery complete! Found ${message.projects.length} projects`)
            break
            
          case 'discoveryError':
            setError(message.error)
            setIsDiscovering(false)
            console.error('Discovery error:', message.error)
            break
        }
      } catch (err) {
        console.error('Error processing discovery WebSocket message:', err)
      }
    }
    
    return () => {
      ws.close()
    }
  }, [])

  // Start auto-discovery
  const startDiscovery = useCallback(async (options: DiscoveryOptions = {}) => {
    try {
      setError(null)
      setIsDiscovering(true)
      setDiscoveredProjects([])
      setProgress({ phase: 'Starting discovery...', current: 0, total: 0, found: 0 })
      
      const response = await fetch(`${SERVER_URL}/api/discovery/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start discovery')
      }
      
      const result = await response.json()
      console.log('🚀 Discovery started:', result.message)
      
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Failed to start discovery: ${errorMessage}`)
      setIsDiscovering(false)
      return { success: false, error: errorMessage }
    }
  }, [])

  // Get discovery status
  const getDiscoveryStatus = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/discovery/status`)
      if (response.ok) {
        const status = await response.json()
        setIsDiscovering(status.isScanning)
        setProgress(status.progress)
        return status
      }
    } catch (err) {
      console.error('Failed to get discovery status:', err)
    }
  }, [])

  // Get discovered projects
  const loadDiscoveredProjects = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/discovery/projects`)
      if (response.ok) {
        const projects = await response.json()
        setDiscoveredProjects(projects)
        return projects
      }
    } catch (err) {
      console.error('Failed to load discovered projects:', err)
    }
  }, [])

  // Add selected projects to the main project list
  const addSelectedProjects = useCallback(async () => {
    try {
      if (selectedProjects.size === 0) {
        return { success: false, error: 'No projects selected' }
      }

      const response = await fetch(`${SERVER_URL}/api/discovery/add-selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectIds: Array.from(selectedProjects) }),
      })
      
      if (response.ok) {
        const result = await response.json()
        const successful = result.results.filter((r: any) => r.success)
        const failed = result.results.filter((r: any) => !r.success)
        
        // Clear selections for successful additions
        const newSelected = new Set(selectedProjects)
        successful.forEach((r: any) => newSelected.delete(r.id))
        setSelectedProjects(newSelected)
        
        console.log(`✅ Added ${successful.length} projects`)
        if (failed.length > 0) {
          console.warn(`⚠️ Failed to add ${failed.length} projects`)
        }
        
        return { 
          success: true, 
          added: successful.length,
          failed: failed.length,
          errors: failed
        }
      } else {
        const error = await response.json()
        return { success: false, error: error.error }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: errorMessage }
    }
  }, [selectedProjects])

  // Project selection management
  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev)
      if (newSet.has(projectId)) {
        newSet.delete(projectId)
      } else {
        newSet.add(projectId)
      }
      return newSet
    })
  }, [])

  const selectAllProjects = useCallback(() => {
    setSelectedProjects(new Set(discoveredProjects.map(p => p.id)))
  }, [discoveredProjects])

  const deselectAllProjects = useCallback(() => {
    setSelectedProjects(new Set())
  }, [])

  // Quick discovery presets
  const quickDiscovery = useCallback(() => {
    return startDiscovery({
      includeGitScan: true,
      includeFullScan: false
    })
  }, [startDiscovery])

  const deepDiscovery = useCallback(() => {
    return startDiscovery({
      includeGitScan: true,
      includeFullScan: true,
      fullScanOptions: {
        maxDepth: 6,
        skipHidden: true,
        skipSystem: true
      }
    })
  }, [startDiscovery])

  const customDiscovery = useCallback((options: DiscoveryOptions) => {
    return startDiscovery(options)
  }, [startDiscovery])

  // Load status on mount
  useEffect(() => {
    getDiscoveryStatus()
    loadDiscoveredProjects()
  }, [getDiscoveryStatus, loadDiscoveredProjects])

  return {
    // State
    discoveredProjects,
    isDiscovering,
    progress,
    selectedProjects,
    error,
    
    // Actions
    startDiscovery,
    quickDiscovery,
    deepDiscovery,
    customDiscovery,
    addSelectedProjects,
    
    // Selection management
    toggleProjectSelection,
    selectAllProjects,
    deselectAllProjects,
    
    // Data loading
    getDiscoveryStatus,
    loadDiscoveredProjects,
    
    // Computed
    selectedCount: selectedProjects.size,
    totalDiscovered: discoveredProjects.length,
    canAddProjects: selectedProjects.size > 0 && !isDiscovering
  }
}