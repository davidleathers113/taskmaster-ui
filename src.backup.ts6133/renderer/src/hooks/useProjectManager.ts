import { useState, useEffect, useCallback } from 'react'
import { useTaskStore } from '@/store/useTaskStore'

interface Project {
  id: string
  name: string
  path: string
  taskCount: number
  lastUpdated: string
}

interface ProjectData {
  id: string
  name: string
  path: string
  data: { tasks: any[] }
  lastUpdated: string
}

const SERVER_URL = 'http://localhost:3001'

export function useProjectManager() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { loadFromJSON } = useTaskStore()

  // WebSocket connection for live updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001`)
    
    ws.onopen = () => {
      console.log('🔗 Connected to TaskMaster file watcher')
      setIsConnected(true)
    }
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        if (message.type === 'fileUpdate') {
          console.log(`📊 Live update from ${message.projectId}`)
          
          // Update projects list
          setProjects(prev => prev.map(p => 
            p.id === message.projectId 
              ? { ...p, taskCount: message.data.tasks?.length || 0, lastUpdated: new Date().toISOString() }
              : p
          ))
          
          // If this is the active project, update the UI
          if (message.projectId === activeProject) {
            loadFromJSON(message.data)
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err)
      }
    }
    
    ws.onclose = () => {
      console.log('🔌 Disconnected from TaskMaster file watcher')
      setIsConnected(false)
    }
    
    return () => {
      ws.close()
    }
  }, [activeProject, loadFromJSON])

  // Load projects list
  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${SERVER_URL}/api/projects`)
      if (response.ok) {
        const projectList = await response.json()
        setProjects(projectList)
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Add a new project
  const addProject = useCallback(async (name: string, path: string) => {
    try {
      setIsLoading(true)
      const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      
      const response = await fetch(`${SERVER_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, name, path }),
      })
      
      if (response.ok) {
        await loadProjects()
        return { success: true, id }
      } else {
        const error = await response.json()
        return { success: false, error: error.error }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to add project: ${errorMessage}` }
    } finally {
      setIsLoading(false)
    }
  }, [loadProjects])

  // Remove project
  const removeProject = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`${SERVER_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        if (activeProject === projectId) {
          setActiveProject(null)
        }
        await loadProjects()
        return { success: true }
      } else {
        return { success: false, error: 'Failed to remove project' }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to remove project: ${errorMessage}` }
    } finally {
      setIsLoading(false)
    }
  }, [activeProject, loadProjects])

  // Switch to a project
  const switchToProject = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`${SERVER_URL}/api/projects/${projectId}`)
      
      if (response.ok) {
        const projectData: ProjectData = await response.json()
        loadFromJSON(projectData.data)
        setActiveProject(projectId)
        return { success: true }
      } else {
        return { success: false, error: 'Failed to load project data' }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to switch to project: ${errorMessage}` }
    } finally {
      setIsLoading(false)
    }
  }, [loadFromJSON])

  // Add project using File System Access API (for modern browsers)
  const addProjectWithFilePicker = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      return { success: false, error: 'File System Access API not supported' }
    }

    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker()
      const projectName = dirHandle.name
      
      // For now, we'll use a placeholder path since we can't get the actual file path
      // In a real implementation, you'd need to store the directory handle
      const result = await addProject(projectName, `[Browser Selected] ${projectName}`)
      
      if (result.success) {
        // Store the directory handle for future use
        // Note: This would require additional implementation to work with the file watcher
        console.log('📁 Project added via file picker:', projectName)
      }
      
      return result
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'User cancelled file selection' }
      }
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Failed to select directory: ${errorMessage}` }
    }
  }, [addProject])

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return {
    projects,
    activeProject,
    isConnected,
    isLoading,
    addProject,
    removeProject,
    switchToProject,
    addProjectWithFilePicker,
    loadProjects
  }
}