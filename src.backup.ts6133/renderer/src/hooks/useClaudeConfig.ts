import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ClaudeConfig, 
  ClaudeConfigStats, 
  ConfigPageState, 
  ConfigError, 
  UseClaudeConfigReturn,
  createTimestamp,
  isSuccessResponse,
  isErrorResponse,
  ApiResponse
} from '@/types/claude-config';

// Enhanced hook with modern 2025 patterns and performance optimizations
export function useClaudeConfig(configPath: string = '/Users/davidleathers/.claude.json'): UseClaudeConfigReturn {
  const [state, setState] = useState<ConfigPageState>({ status: 'idle' });

  // Memoized computed values for performance
  const isLoading = useMemo(() => state.status === 'loading', [state.status]);
  
  const error = useMemo(() => 
    state.status === 'error' ? state.error : null, 
    [state]
  );
  
  const config = useMemo(() => 
    state.status === 'success' ? state.config : null, 
    [state]
  );
  
  const stats = useMemo(() => 
    state.status === 'success' ? state.stats : null, 
    [state]
  );

  // Enhanced error mapping with discriminated unions
  const mapApiErrorToConfigError = useCallback((error: unknown, response?: Response): ConfigError => {
    if (response) {
      switch (response.status) {
        case 403:
          return {
            type: 'PERMISSION_DENIED',
            path: configPath
          };
        case 404:
          return {
            type: 'FILE_NOT_FOUND',
            path: configPath
          };
        case 413:
          return {
            type: 'VALIDATION_ERROR',
            message: 'File size too large',
            field: 'fileSize'
          };
        case 429:
          return {
            type: 'NETWORK_ERROR',
            message: 'Rate limit exceeded, please try again later',
            statusCode: 429
          };
        default:
          return {
            type: 'NETWORK_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
            statusCode: response.status
          };
      }
    }

    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        return {
          type: 'PARSE_ERROR',
          message: 'Invalid JSON format in configuration file'
        };
      }
      if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        return {
          type: 'NETWORK_ERROR',
          message: 'Network connection failed'
        };
      }
      return {
        type: 'UNKNOWN_ERROR',
        message: error.message
      };
    }

    return {
      type: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred'
    };
  }, [configPath]);

  // Optimized stats calculation with memoization
  const calculateStats = useCallback((config: ClaudeConfig): ClaudeConfigStats => {
    const totalProjects = Object.keys(config.projects).length;
    
    // Calculate global MCP servers
    const globalMcpServers = Object.keys(config.mcpServers || {}).length;
    
    // Calculate project-specific MCP servers
    const projectMcpServers = Object.values(config.projects)
      .reduce((acc, project) => acc + Object.keys(project.mcpServers || {}).length, 0);
    
    const totalMcpServers = globalMcpServers + projectMcpServers;
    
    // Calculate total conversations
    const totalConversations = Object.values(config.projects)
      .reduce((acc, project) => acc + (project.history?.length || 0), 0);

    return {
      totalProjects,
      totalMcpServers,
      totalConversations,
      lastModified: createTimestamp(),
      fileSize: '0 MB', // Will be updated by API response
      fileSizeBytes: 0
    };
  }, []);

  // Enhanced load configuration with proper error handling
  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      setState({ status: 'loading' });

      const response = await fetch('/api/claude-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configPath }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        const error = mapApiErrorToConfigError(new Error(`HTTP ${response.status}`), response);
        setState({ status: 'error', error });
        return;
      }

      if (isSuccessResponse(data)) {
        const calculatedStats = calculateStats(data.config);
        const finalStats: ClaudeConfigStats = {
          ...calculatedStats,
          lastModified: data.lastModified,
          fileSize: data.fileSize,
          fileSizeBytes: data.fileSizeBytes
        };

        setState({
          status: 'success',
          config: data.config,
          stats: finalStats
        });
      } else if (isErrorResponse(data)) {
        const error: ConfigError = {
          type: 'UNKNOWN_ERROR',
          message: data.error
        };
        setState({ status: 'error', error });
      } else {
        const error: ConfigError = {
          type: 'PARSE_ERROR',
          message: 'Invalid response format from server'
        };
        setState({ status: 'error', error });
      }

    } catch (error) {
      const configError = mapApiErrorToConfigError(error);
      setState({ status: 'error', error: configError });
    }
  }, [configPath, mapApiErrorToConfigError, calculateStats]);

  // Load config on mount and when configPath changes
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Refresh function with debouncing for performance
  const refreshConfig = useCallback(async (): Promise<void> => {
    // Prevent multiple simultaneous refresh calls
    if (state.status === 'loading') {
      return;
    }
    
    await loadConfig();
  }, [loadConfig, state.status]);

  // Return memoized object to prevent unnecessary re-renders
  return useMemo((): UseClaudeConfigReturn => ({
    state,
    refreshConfig,
    isLoading,
    error,
    config,
    stats
  }), [state, refreshConfig, isLoading, error, config, stats]);
}

export default useClaudeConfig;