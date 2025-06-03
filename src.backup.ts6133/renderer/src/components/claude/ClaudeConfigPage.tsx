import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  Button
} from '@mui/material'
import {
  Settings,
  Memory,
  Storage,
  Chat,
  Refresh,
  Computer,
  Cloud,
  Code,
  Timeline,
  ExpandMore,
  ExpandLess,
  ErrorOutline,
  CheckCircleOutline
} from '@mui/icons-material'
import { JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'

import { useClaudeConfig } from '@/hooks/useClaudeConfig'
import { MCPServer, ConfigError } from '@/types/claude-config'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`claude-config-tabpanel-${index}`}
      aria-labelledby={`claude-config-tab-${index}`}
      tabIndex={value === index ? 0 : -1}
      {...other}
    >
      {value === index && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ outline: 'none' }}
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}

function StatsCard({ icon, title, value, color }: { 
  icon: React.ReactNode
  title: string
  value: string | number
  color: string 
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        sx={{ 
          height: '100%', 
          background: `linear-gradient(135deg, ${color}15, ${color}05)`,
          '&:focus-within': {
            outline: `2px solid ${color}`,
            outlineOffset: '2px'
          }
        }}
        role="group"
        aria-label={`${title}: ${value}`}
      >
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Box 
              sx={{ color, fontSize: '2rem' }}
              role="img"
              aria-label={`${title} icon`}
            >
              {icon}
            </Box>
            <Box>
              <Typography 
                variant="h4" 
                fontWeight="bold"
                aria-label={`${title} value: ${value}`}
              >
                {value}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                id={`stats-title-${title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {title}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MCPServerCard({ name, server, isGlobal = false }: { 
  name: string
  server: MCPServer
  isGlobal?: boolean 
}) {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()
  const cardRef = useRef<HTMLDivElement>(null)

  const getServerTypeIcon = (command: string) => {
    if (command === 'npx') return <Code />
    if (command === 'docker') return <Computer />
    if (command.includes('python')) return <Code />
    return <Storage />
  }

  const getServerTypeColor = (command: string) => {
    if (command === 'npx') return '#f59e0b'
    if (command === 'docker') return '#0ea5e9'
    if (command.includes('python')) return '#10b981'
    return '#8b5cf6'
  }

  const getServerTypeLabel = (command: string) => {
    if (command === 'npx') return 'NPX Package'
    if (command === 'docker') return 'Docker Container'
    if (command.includes('python')) return 'Python Script'
    return 'Binary Executable'
  }

  const handleExpandToggle = () => {
    setExpanded(!expanded)
  }

  useEffect(() => {
    if (expanded && cardRef.current) {
      const expandedContent = cardRef.current.querySelector('[data-expanded-content]')
      if (expandedContent) {
        (expandedContent as HTMLElement).focus()
      }
    }
  }, [expanded])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
    >
      <Card 
        ref={cardRef}
        sx={{ 
          mb: 2, 
          border: isGlobal ? '2px solid #10b981' : '1px solid #e5e7eb',
          '&:focus-within': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px'
          }
        }}
        role="region"
        aria-labelledby={`server-${name.replace(/\s+/g, '-')}-title`}
        aria-describedby={`server-${name.replace(/\s+/g, '-')}-description`}
      >
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box 
                sx={{ color: getServerTypeColor(server.command) }}
                role="img"
                aria-label={getServerTypeLabel(server.command)}
              >
                {getServerTypeIcon(server.command)}
              </Box>
              <Box>
                <Typography 
                  variant="h6" 
                  fontWeight="bold"
                  id={`server-${name.replace(/\s+/g, '-')}-title`}
                >
                  {name}
                </Typography>
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  id={`server-${name.replace(/\s+/g, '-')}-description`}
                >
                  {server.command} {server.args?.join(' ')}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              {isGlobal && (
                <Chip 
                  label="Global" 
                  size="small" 
                  color="success" 
                  variant="outlined"
                  icon={<CheckCircleOutline />}
                  aria-label="This is a global MCP server available to all projects"
                />
              )}
              {server.disabled && (
                <Chip 
                  label="Disabled" 
                  size="small" 
                  color="error" 
                  variant="outlined"
                  icon={<ErrorOutline />}
                  aria-label="This MCP server is currently disabled"
                />
              )}
              <Tooltip title={expanded ? 'Hide server details' : 'Show server details'}>
                <IconButton 
                  size="small"
                  onClick={handleExpandToggle}
                  aria-expanded={expanded}
                  aria-controls={`server-${name.replace(/\s+/g, '-')}-details`}
                  aria-label={`${expanded ? 'Hide' : 'Show'} details for ${name} server`}
                >
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              id={`server-${name.replace(/\s+/g, '-')}-details`}
              data-expanded-content
              tabIndex={-1}
              role="region"
              aria-label={`Detailed configuration for ${name} server`}
            >
              <Divider sx={{ mb: 2 }} aria-hidden="true" />
              <Typography variant="subtitle2" gutterBottom>
                Server Configuration Details
              </Typography>
              <JsonView 
                data={server} 
                shouldExpandNode={(level) => level < 2}
              />
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function ClaudeConfigPage() {
  const [activeTab, setActiveTab] = useState(0)
  const { config, stats, isLoading, error, refreshConfig } = useClaudeConfig()
  const errorAnnounceRef = useRef<HTMLDivElement>(null)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  // Announce errors to screen readers
  useEffect(() => {
    if (error && errorAnnounceRef.current) {
      errorAnnounceRef.current.focus()
    }
  }, [error])

  const getErrorMessage = (error: ConfigError): string => {
    switch (error.type) {
      case 'FILE_NOT_FOUND':
        return `Configuration file not found at ${error.path}. Please ensure the file exists.`
      case 'PERMISSION_DENIED':
        return `Permission denied accessing ${error.path}. Please check file permissions.`
      case 'NETWORK_ERROR':
        return `Network error: ${error.message}. Please check your connection and try again.`
      case 'VALIDATION_ERROR':
        return `Validation error: ${error.message}${error.field ? ` in field ${error.field}` : ''}.`
      case 'PARSE_ERROR':
        return `Parse error: ${error.message}. The configuration file may be corrupted.`
      default:
        return `Error: ${error.message}`
    }
  }

  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="60vh"
        role="status"
        aria-live="polite"
        aria-label="Loading Claude configuration"
      >
        <Box textAlign="center">
          <CircularProgress 
            size={60} 
            aria-label="Loading indicator"
          />
          <Typography 
            variant="h6" 
            sx={{ mt: 2 }}
            id="loading-message"
          >
            Loading Claude Configuration...
          </Typography>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={3} role="main" aria-labelledby="error-heading">
        <div 
          ref={errorAnnounceRef}
          tabIndex={-1}
          aria-live="assertive"
          aria-atomic="true"
          style={{ outline: 'none' }}
        >
          <Typography 
            variant="h4" 
            gutterBottom 
            id="error-heading"
            color="error"
          >
            Configuration Error
          </Typography>
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            role="alert"
            aria-describedby="error-description"
          >
            {getErrorMessage(error)}
          </Alert>
        </div>
        <Typography 
          variant="body2" 
          color="text.secondary"
          id="error-description"
        >
          Make sure the Claude configuration file exists and is accessible.
        </Typography>
        <Button
          variant="contained"
          onClick={refreshConfig}
          sx={{ mt: 2 }}
          startIcon={<Refresh />}
          aria-label="Retry loading configuration"
        >
          Try Again
        </Button>
      </Box>
    )
  }

  if (!config) {
    return (
      <Box p={3} role="main" aria-labelledby="warning-heading">
        <Typography 
          variant="h4" 
          gutterBottom 
          id="warning-heading"
          color="warning.main"
        >
          No Configuration Data
        </Typography>
        <Alert 
          severity="warning"
          role="alert"
          aria-describedby="warning-description"
        >
          No configuration data available.
        </Alert>
        <Typography 
          variant="body2" 
          color="text.secondary"
          id="warning-description"
          sx={{ mt: 1 }}
        >
          The configuration may still be loading or there may be an issue with the file.
        </Typography>
        <Button
          variant="outlined"
          onClick={refreshConfig}
          sx={{ mt: 2 }}
          startIcon={<Refresh />}
          aria-label="Refresh configuration data"
        >
          Refresh
        </Button>
      </Box>
    )
  }

  return (
    <Box 
      className="claude-config-page"
      role="main"
      aria-labelledby="page-title"
    >
      {/* Screen reader announcement region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
        {isLoading && 'Loading configuration...'}
        {error && `Error: ${getErrorMessage(error)}`}
        {config && 'Configuration loaded successfully'}
      </div>

      {/* Header */}
      <Box 
        component="header"
        display="flex" 
        justifyContent="between" 
        alignItems="center" 
        mb={4}
      >
        <Box>
          <Typography 
            variant="h3" 
            fontWeight="bold" 
            gutterBottom
            id="page-title"
          >
            Claude Configuration
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary"
            id="page-description"
          >
            View and manage your Claude Code configuration, MCP servers, and project settings
          </Typography>
        </Box>
        <Tooltip title="Refresh Configuration">
          <IconButton 
            onClick={refreshConfig} 
            size="large"
            aria-label="Refresh Claude configuration data"
            disabled={isLoading}
          >
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Box 
          display="grid" 
          gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" 
          gap={3} 
          sx={{ mb: 4 }}
          role="group"
          aria-label="Configuration statistics"
        >
          <StatsCard
            icon={<Memory />}
            title="Total Projects"
            value={stats.totalProjects}
            color="#10b981"
          />
          <StatsCard
            icon={<Storage />}
            title="MCP Servers"
            value={stats.totalMcpServers}
            color="#3b82f6"
          />
          <StatsCard
            icon={<Chat />}
            title="Conversations"
            value={stats.totalConversations}
            color="#f59e0b"
          />
          <StatsCard
            icon={<Timeline />}
            title="Startups"
            value={config.numStartups}
            color="#8b5cf6"
          />
        </Box>
      )}

      {/* Tabs */}
      <Paper sx={{ width: '100%' }} elevation={1}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Claude configuration sections"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab 
            label="Overview" 
            icon={<Settings />} 
            id="claude-config-tab-0"
            aria-controls="claude-config-tabpanel-0"
            aria-label="Configuration overview"
          />
          <Tab 
            label="Global MCP Servers" 
            icon={<Cloud />} 
            id="claude-config-tab-1"
            aria-controls="claude-config-tabpanel-1"
            aria-label="Global MCP server configurations"
          />
          <Tab 
            label="Projects" 
            icon={<Memory />} 
            id="claude-config-tab-2"
            aria-controls="claude-config-tabpanel-2"
            aria-label="Project-specific configurations"
          />
          <Tab 
            label="Conversation History" 
            icon={<Chat />} 
            id="claude-config-tab-3"
            aria-controls="claude-config-tabpanel-3"
            aria-label="Conversation history data"
          />
          <Tab 
            label="Raw JSON" 
            icon={<Code />} 
            id="claude-config-tab-4"
            aria-controls="claude-config-tabpanel-4"
            aria-label="Raw configuration data in JSON format"
          />
        </Tabs>

        {/* Tab Content */}
        <Box p={3}>
          {/* Overview Tab */}
          <TabPanel value={activeTab} index={0}>
            <Typography variant="h5" gutterBottom component="h2">
              Global Settings
            </Typography>
            <Box 
              display="grid" 
              gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" 
              gap={3}
              role="group"
              aria-labelledby="global-settings-heading"
            >
              <Card role="region" aria-labelledby="general-settings-heading">
                <CardContent>
                  <Typography 
                    variant="h6" 
                    gutterBottom 
                    component="h3"
                    id="general-settings-heading"
                  >
                    General
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2} component="dl">
                    <Box display="flex" justifyContent="between" alignItems="center">
                      <Typography component="dt">Startup Count</Typography>
                      <Chip 
                        label={config.numStartups} 
                        color="primary" 
                        aria-label={`Application has been started ${config.numStartups} times`}
                        component="dd"
                      />
                    </Box>
                    <Box display="flex" justifyContent="between" alignItems="center">
                      <Typography component="dt">Prompt Queue Usage</Typography>
                      <Chip 
                        label={config.promptQueueUseCount || 0} 
                        color="secondary" 
                        aria-label={`Prompt queue has been used ${config.promptQueueUseCount || 0} times`}
                        component="dd"
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              <Card role="region" aria-labelledby="tips-history-heading">
                <CardContent>
                  <Typography 
                    variant="h6" 
                    gutterBottom 
                    component="h3"
                    id="tips-history-heading"
                  >
                    Tips History
                  </Typography>
                  <Box 
                    role="group" 
                    aria-label="Tips shown to user with frequency counts"
                  >
                    <JsonView 
                      data={config.tipsHistory} 
                      shouldExpandNode={() => true}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </TabPanel>

          {/* Global MCP Servers Tab */}
          <TabPanel value={activeTab} index={1}>
            <Typography variant="h5" gutterBottom component="h2">Global MCP Servers</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              These servers are available across all projects by default.
            </Typography>
            <Box role="group" aria-label="Global MCP server configurations">
              {Object.entries(config.mcpServers || {}).map(([name, server]) => (
                <MCPServerCard 
                  key={name} 
                  name={name} 
                  server={server} 
                  isGlobal={true}
                />
              ))}
            </Box>
          </TabPanel>

          {/* Projects Tab */}
          <TabPanel value={activeTab} index={2}>
            <Typography variant="h5" gutterBottom component="h2">Project Configurations</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Project-specific settings and MCP server configurations.
            </Typography>
            <Box role="group" aria-label="Project configurations">
              {Object.entries(config.projects || {}).map(([path, projectConfig]) => (
                <Card key={path} sx={{ mb: 3 }} role="region" aria-labelledby={`project-${path.replace(/[^a-zA-Z0-9]/g, '-')}-heading`}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom component="h3" id={`project-${path.replace(/[^a-zA-Z0-9]/g, '-')}-heading`}>{path}</Typography>
                    {projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0 && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom component="h4">Project MCP Servers:</Typography>
                        {Object.entries(projectConfig.mcpServers).map(([name, server]) => (
                          <MCPServerCard 
                            key={`${path}-${name}`} 
                            name={name} 
                            server={server} 
                          />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </TabPanel>

          {/* Conversation History Tab */}
          <TabPanel value={activeTab} index={3}>
            <Typography variant="h5" gutterBottom component="h2">Conversation History</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Recent conversations from all projects.
            </Typography>
            <Box role="group" aria-label="Conversation history by project">
              {Object.entries(config.projects || {}).map(([path, projectConfig]) => (
                projectConfig.history && projectConfig.history.length > 0 && (
                  <Card key={path} sx={{ mb: 3 }} role="region" aria-labelledby={`history-${path.replace(/[^a-zA-Z0-9]/g, '-')}-heading`}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom component="h3" id={`history-${path.replace(/[^a-zA-Z0-9]/g, '-')}-heading`}>{path}</Typography>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {projectConfig.history.length} conversations
                      </Typography>
                      <JsonView 
                        data={projectConfig.history.slice(0, 5)} 
                        shouldExpandNode={(level) => level < 1}
                      />
                    </CardContent>
                  </Card>
                )
              ))}
            </Box>
          </TabPanel>

          {/* Raw JSON Tab */}
          <TabPanel value={activeTab} index={4}>
            <Typography variant="h5" gutterBottom component="h2">Raw Configuration</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Complete Claude configuration in JSON format.
            </Typography>
            <Paper sx={{ p: 2, backgroundColor: '#f8f9fa' }} role="region" aria-label="Raw JSON configuration data">
              <JsonView 
                data={config} 
                shouldExpandNode={(level) => level < 2}
              />
            </Paper>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  )
}