import { useState, useEffect, useCallback, useRef } from 'react'
import { useTaskStore } from '../store/useTaskStore'

// Generic task interface for type safety
interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority?: string
  [key: string]: unknown
}

// Generic project interfaces with proper typing
interface Project {
  id: string
  name: string
  path: string
  taskCount: number
  lastUpdated: string
}

interface ProjectData<TTask = Task> {
  id: string
  name: string
  path: string
  data: { tasks: TTask[] }
  lastUpdated: string
}

// Connection status with retry information
type ConnectionStatus = 
  | { state: 'connecting' }
  | { state: 'connected' }
  | { state: 'disconnected' }
  | { state: 'reconnecting'; attempt: number; maxAttempts: number }
  | { state: 'error'; message: string }

// Explicit hook return type for better DX
export interface UseProjectManagerReturn<TTask = Task> {
  projects: Project[]
  activeProject: string | null
  isConnected: boolean
  isLoading: boolean
  connectionStatus: ConnectionStatus
  retryStatus: { isRetrying: boolean; attempt: number; maxAttempts: number } | null
  addProject: (name: string, path: string) => Promise<{ success: boolean; id?: string; error?: string }>
  removeProject: (projectId: string) => Promise<{ success: boolean; error?: string }>
  switchToProject: (projectId: string) => Promise<{ success: boolean; error?: string }>
  addProjectWithFilePicker: () => Promise<{ success: boolean; error?: string }>
  loadProjects: () => Promise<void>
}

// AbortSignal.timeout polyfill for Safari ≤ 17 and older browsers
const createTimeoutSignal = (timeoutMs: number): AbortSignal => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  
  // Polyfill fallback
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

// Combine multiple abort signals (user cancel + timeout)
const combineSignals = (signals: AbortSignal[]): AbortSignal => {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals)
  }
  
  // Polyfill fallback
  const controller = new AbortController()
  
  const abort = () => {
    controller.abort()
    signals.forEach(signal => {
      signal.removeEventListener('abort', abort)
    })
  }
  
  signals.forEach(signal => {
    if (signal.aborted) {
      controller.abort()
      return
    }
    signal.addEventListener('abort', abort)
  })
  
  return controller.signal
}

// Jittered exponential backoff calculation
const calculateBackoffDelay = (attempt: number, baseDelay = 1000, maxDelay = 30000): number => {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
  const jitter = Math.random() * exponentialDelay * 0.2 // ±20% jitter
  return Math.floor(exponentialDelay + jitter)
}

// Centralized error reporting
const reportError = (error: Error, context: string) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, error)
  }
  // In production, send to Sentry/LogRocket
  // Sentry.captureException(error, { tags: { context } })
}

// Dynamic server URL detection with enhanced retry logic
const detectServerUrl = async (userSignal?: AbortSignal): Promise<string> => {
  const ports = [3001, 3002, 3003, 3004, 3005]
  
  for (const port of ports) {
    try {
      const signals = [createTimeoutSignal(2000)]
      if (userSignal) signals.push(userSignal)
      
      const response = await fetch(`http://localhost:${port}/api/health`, { 
        signal: combineSignals(signals)
      })
      
      if (response.ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`✅ Found server on port ${port}`)
        }
        return `http://localhost:${port}`
      }
    } catch (error) {
      // Continue to next port
    }
  }
  
  // Default fallback
  return 'http://localhost:3001'
}

export function useProjectManager<TTask = Task>(): UseProjectManagerReturn<TTask> {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ state: 'disconnected' })
  const [retryStatus, setRetryStatus] = useState<{ isRetrying: boolean; attempt: number; maxAttempts: number } | null>(null)
  const { loadFromJSON } = useTaskStore()
  
  // Use ref to avoid stale closures in WebSocket callbacks
  const serverUrlRef = useRef('http://localhost:3001')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastPongRef = useRef<number>(Date.now())
  
  // Map for O(1) project lookups
  const projectMapRef = useRef(new Map<string, Project>())

  // Initialize server URL detection
  useEffect(() => {
    const controller = new AbortController()
    
    const initializeConnection = async () => {
      setConnectionStatus({ state: 'connecting' })
      try {
        const url = await detectServerUrl(controller.signal)
        serverUrlRef.current = url
        
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🎯 Using server URL: ${url}`)
        }
        
        setConnectionStatus({ state: 'connected' })
      } catch (error) {
        if (!controller.signal.aborted) {
          reportError(error as Error, 'server-detection')
          setConnectionStatus({ state: 'error', message: 'Failed to detect server' })
        }
      }
    }
    
    initializeConnection()
    
    return () => {
      controller.abort()
    }
  }, [])

  // WebSocket connection management (split from message handling)
  useEffect(() => {
    if (connectionStatus.state !== 'connected') return

    let reconnectAttempts = 0
    const maxReconnectAttempts = 10
    const heartbeatInterval = 30000 // 30 seconds
    const heartbeatTimeout = 60000 // 60 seconds

    const cleanupTimers = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (heartbeatTimeoutRef.current) {
        clearInterval(heartbeatTimeoutRef.current)
        heartbeatTimeoutRef.current = null
      }
    }

    const connect = () => {
      try {
        const wsUrl = serverUrlRef.current.replace('http:', 
          process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:')
        
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        
        ws.onopen = () => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('🔗 Connected to TaskMaster file watcher')
          }
          
          setIsConnected(true)
          setConnectionStatus({ state: 'connected' })
          setRetryStatus(null)
          reconnectAttempts = 0
          lastPongRef.current = Date.now()
          
          // Start heartbeat monitoring (browser WebSocket doesn't have ping/pong)
          // Instead, we'll send a heartbeat message and expect a response
          heartbeatTimeoutRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              // Send heartbeat message
              try {
                ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }))
              } catch {
                // Connection might be broken
                ws.close(4000, 'Failed to send heartbeat')
              }
              
              // Check if connection is stale (no activity for too long)
              if (Date.now() - lastPongRef.current > heartbeatTimeout) {
                if (process.env.NODE_ENV !== 'production') {
                  console.warn('🔥 Heartbeat timeout - terminating connection')
                }
                ws.close(4000, 'Heartbeat timeout')
              }
            }
          }, heartbeatInterval)
        }
        
        ws.onclose = (event) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('🔌 Disconnected from TaskMaster file watcher', event.code)
          }
          
          setIsConnected(false)
          cleanupTimers()
          
          // Don't reconnect if manually closed or during cleanup
          if (event.code === 1000 || event.code === 4000) return
          
          // Attempt reconnection with jittered exponential backoff
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = calculateBackoffDelay(reconnectAttempts + 1)
            
            setConnectionStatus({ 
              state: 'reconnecting', 
              attempt: reconnectAttempts + 1, 
              maxAttempts: maxReconnectAttempts 
            })
            
            setRetryStatus({ 
              isRetrying: true, 
              attempt: reconnectAttempts + 1, 
              maxAttempts: maxReconnectAttempts 
            })
            
            if (process.env.NODE_ENV !== 'production') {
              console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`)
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts++
              connect()
            }, delay)
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.error('❌ Max reconnection attempts reached')
            }
            setConnectionStatus({ state: 'error', message: 'Connection failed after maximum retries' })
            setRetryStatus(null)
          }
        }
        
        ws.onerror = (error) => {
          reportError(new Error('WebSocket error'), 'websocket')
        }
        
      } catch (error) {
        reportError(error as Error, 'websocket-connect')
        setIsConnected(false)
      }
    }

    connect()
    
    return () => {
      cleanupTimers()
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [connectionStatus.state])
  
  // Separate effect for handling WebSocket messages
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    
    const handleMessage = (event: MessageEvent) => {
      try {
        // Update last activity timestamp for any message (heartbeat detection)
        lastPongRef.current = Date.now()
        
        const message = JSON.parse(event.data)
        
        // Handle heartbeat responses (server echo)
        if (message.type === 'heartbeat') {
          return // Just update the timestamp, no other processing needed
        }
        
        if (message.type === 'fileUpdate') {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`📊 Live update from ${message.projectId}`)
          }
          
          // Update projects using Map for O(1) lookup
          setProjects(prev => {
            const newProjects = prev.map(p => {
              if (p.id === message.projectId) {
                const updated = { 
                  ...p, 
                  taskCount: message.data.tasks?.length || 0, 
                  lastUpdated: new Date().toISOString() 
                }
                projectMapRef.current.set(p.id, updated)
                return updated
              }
              return p
            })
            return newProjects
          })
          
          // If this is the active project, update the UI
          if (message.projectId === activeProject) {
            loadFromJSON(message.data)
          }
        }
      } catch (error) {
        reportError(error as Error, 'websocket-message')
      }
    }
    
    ws.addEventListener('message', handleMessage)
    
    return () => {
      ws.removeEventListener('message', handleMessage)
    }
  }, [activeProject, loadFromJSON])

  // Enhanced retry helper function with jittered backoff
  const retryFetch = useCallback(async (
    url: string, 
    options?: RequestInit, 
    maxRetries = 3,
    userSignal?: AbortSignal
  ): Promise<Response> => {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const signals = [createTimeoutSignal(5000)] // 5 second timeout
        if (userSignal) signals.push(userSignal)
        
        const response = await fetch(url, { 
          ...options, 
          signal: combineSignals(signals)
        })
        
        if (response.ok) {
          return response
        }
        
        // If it's a server error (5xx), retry
        if (response.status >= 500 && attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt)
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔄 Server error (${response.status}), retrying in ${delay}ms...`)
          }
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        return response // Return non-5xx errors immediately
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt)
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔄 Request failed, retrying in ${delay}ms... (${lastError.message})`)
          }
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }, [])

  // Load projects list with retry
  const loadProjects = useCallback(async () => {
    if (connectionStatus.state !== 'connected') return
    
    try {
      setIsLoading(true)
      const response = await retryFetch(`${serverUrlRef.current}/api/projects`)
      
      if (response.ok) {
        const projectList: Project[] = await response.json()
        setProjects(projectList)
        
        // Update project map for O(1) lookups
        projectMapRef.current.clear()
        projectList.forEach(project => {
          projectMapRef.current.set(project.id, project)
        })
      } else {
        reportError(
          new Error(`Failed to load projects: ${response.status} ${response.statusText}`),
          'load-projects'
        )
      }
    } catch (error) {
      reportError(error as Error, 'load-projects')
    } finally {
      setIsLoading(false)
    }
  }, [connectionStatus.state, retryFetch])

  // Add a new project with retry
  const addProject = useCallback(async (name: string, path: string) => {
    try {
      setIsLoading(true)
      const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      
      const response = await retryFetch(`${serverUrlRef.current}/api/projects`, {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      reportError(error as Error, 'add-project')
      return { success: false, error: `Failed to add project: ${errorMessage}` }
    } finally {
      setIsLoading(false)
    }
  }, [loadProjects, retryFetch])

  // Remove project with retry
  const removeProject = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true)
      const response = await retryFetch(`${serverUrlRef.current}/api/projects/${projectId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        if (activeProject === projectId) {
          setActiveProject(null)
        }
        projectMapRef.current.delete(projectId)
        await loadProjects()
        return { success: true }
      } else {
        return { success: false, error: 'Failed to remove project' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      reportError(error as Error, 'remove-project')
      return { success: false, error: `Failed to remove project: ${errorMessage}` }
    } finally {
      setIsLoading(false)
    }
  }, [activeProject, loadProjects, retryFetch])

  // Switch to a project with retry
  const switchToProject = useCallback(async (projectId: string) => {
    try {
      setIsLoading(true)
      const response = await retryFetch(`${serverUrlRef.current}/api/projects/${projectId}`)
      
      if (response.ok) {
        const projectData: ProjectData<TTask> = await response.json()
        loadFromJSON(projectData.data)
        setActiveProject(projectId)
        return { success: true }
      } else {
        return { success: false, error: 'Failed to load project data' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      reportError(error as Error, 'switch-project')
      return { success: false, error: `Failed to switch to project: ${errorMessage}` }
    } finally {
      setIsLoading(false)
    }
  }, [loadFromJSON, retryFetch])

  // Add project using File System Access API with enhanced compatibility
  const addProjectWithFilePicker = useCallback(async () => {
    // Feature detection with graceful fallback
    if (!('showDirectoryPicker' in window)) {
      return { 
        success: false, 
        error: 'File System Access API not supported. Please use manual project addition.' 
      }
    }

    try {
      // @ts-expect-error - File System Access API not fully typed
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read'
      })
      
      const projectName = dirHandle.name
      
      // For now, we'll use a placeholder path since we can't get the actual file path
      // In a real implementation, you'd need to store the directory handle
      const result = await addProject(projectName, `[Browser Selected] ${projectName}`)
      
      if (result.success && process.env.NODE_ENV !== 'production') {
        console.log('📁 Project added via file picker:', projectName)
      }
      
      return result
    } catch (error: unknown) {
      // User cancellation is not an error - handle gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: true } // Silent dismissal per UX guidelines
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      reportError(error as Error, 'file-picker')
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
    connectionStatus,
    retryStatus,
    addProject,
    removeProject,
    switchToProject,
    addProjectWithFilePicker,
    loadProjects
  }
}