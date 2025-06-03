// Enhanced TypeScript interfaces for Claude JSON configuration structure
// Following 2025 best practices with branded types, utility types, and strict typing

// Branded types for enhanced type safety
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;

// Domain-specific branded types
export type ServerName = Branded<string, 'ServerName'>;
export type ProjectPath = Branded<string, 'ProjectPath'>;
export type ConfigurationId = Branded<string, 'ConfigurationId'>;
export type HealthCheckUrl = Branded<string, 'HealthCheckUrl'>;
export type TimestampISO = Branded<string, 'TimestampISO'>;

// Utility types for configuration validation
export type NonEmptyArray<T> = [T, ...T[]];
export type NonEmptyString = Branded<string, 'NonEmptyString'>;

// Server type enumeration for enhanced type safety
export const ServerType = {
  NPX: 'npx',
  DOCKER: 'docker', 
  PYTHON: 'python',
  NODE: 'node',
  BINARY: 'binary'
} as const;

export type ServerTypeValue = typeof ServerType[keyof typeof ServerType];

// Status enumeration for UI state management
export const LoadingStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
} as const;

export type LoadingStatusValue = typeof LoadingStatus[keyof typeof LoadingStatus];

// Error handling with discriminated unions
export type ConfigError = 
  | { type: 'NETWORK_ERROR'; message: string; statusCode?: number }
  | { type: 'VALIDATION_ERROR'; message: string; field?: string }
  | { type: 'FILE_NOT_FOUND'; path: string }
  | { type: 'PERMISSION_DENIED'; path: string }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'UNKNOWN_ERROR'; message: string };

// Result type for async operations
export type ConfigResult<T> = 
  | { success: true; data: T }
  | { success: false; error: ConfigError };

// MCP Server configuration with enhanced typing
export interface MCPServer {
  readonly command: NonEmptyString;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly type?: ServerTypeValue;
  readonly healthcheck_url?: HealthCheckUrl;
  readonly disabled?: boolean;
  readonly alwaysAllow?: readonly string[];
}

// Indexed type for server collections
export type MCPServers = Readonly<Record<ServerName, MCPServer>>;

// Conversation history with enhanced structure
export interface ConversationHistoryItem {
  readonly display: NonEmptyString;
  readonly pastedContents: Readonly<Record<string, unknown>>;
  readonly timestamp?: TimestampISO;
  readonly id?: ConfigurationId;
}

// Project configuration with comprehensive typing
export interface ProjectConfig {
  readonly allowedTools?: readonly string[];
  readonly history?: readonly ConversationHistoryItem[];
  readonly mcpServers?: MCPServers;
  readonly hasTrustDialogAccepted?: boolean;
  readonly dontCrawlDirectory?: boolean;
  readonly mcpContextUris?: readonly string[];
  readonly enabledMcpjsonServers?: readonly string[];
  readonly disabledMcpjsonServers?: readonly string[];
  readonly enableAllProjectMcpServers?: boolean;
  readonly ignorePatterns?: readonly string[];
  readonly projectOnboardingSeenCount?: number;
  readonly hasClaudeMdExternalIncludesApproved?: boolean;
  readonly hasClaudeMdExternalIncludesWarningShown?: boolean;
}

// Tips history with exact key typing
export interface TipsHistory {
  readonly 'shift-enter'?: number;
  readonly 'terminal-setup'?: number;
  readonly 'memory-command'?: number;
  readonly 'theme-command'?: number;
  readonly 'prompt-queue'?: number;
  readonly 'todo-list'?: number;
  readonly 'enter-to-steer-in-relatime'?: number;
  readonly 'git-worktrees'?: number;
  readonly 'claude-opus-welcome'?: number;
  readonly 'vscode-command-install'?: number;
}

// Main configuration interface with strict typing
export interface ClaudeConfig {
  readonly numStartups: number;
  readonly tipsHistory: TipsHistory;
  readonly promptQueueUseCount?: number;
  readonly mcpServers: MCPServers;
  readonly projects: Readonly<Record<ProjectPath, ProjectConfig>>;
  readonly theme?: string;
  readonly verbose?: boolean;
}

// Statistics with computed values
export interface ClaudeConfigStats {
  readonly totalProjects: number;
  readonly totalMcpServers: number;
  readonly totalConversations: number;
  readonly lastModified: TimestampISO;
  readonly fileSize: string;
  readonly fileSizeBytes: number;
}

// Component state management with discriminated unions
export type ConfigPageState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; config: ClaudeConfig; stats: ClaudeConfigStats }
  | { status: 'error'; error: ConfigError };

// Component props with enhanced typing
export interface ClaudeConfigPageProps {
  readonly configPath?: string;
  readonly onConfigLoad?: (config: ClaudeConfig) => void;
  readonly onError?: (error: ConfigError) => void;
}

export interface MCPServerCardProps {
  readonly name: ServerName;
  readonly server: MCPServer;
  readonly isGlobal?: boolean;
  readonly onExpand?: (expanded: boolean) => void;
  readonly className?: string;
}

export interface ProjectCardProps {
  readonly path: ProjectPath;
  readonly config: ProjectConfig;
  readonly onSelect?: (path: ProjectPath) => void;
  readonly isSelected?: boolean;
}

export interface StatsCardProps {
  readonly icon: React.ReactNode;
  readonly title: NonEmptyString;
  readonly value: string | number;
  readonly color: string;
  readonly isLoading?: boolean;
}

export interface ConfigSectionProps {
  readonly title: NonEmptyString;
  readonly data: unknown;
  readonly isExpanded?: boolean;
  readonly onToggle?: () => void;
  readonly maxHeight?: number;
}

// API response types with proper error handling
export interface ClaudeConfigResponse {
  readonly config: ClaudeConfig;
  readonly lastModified: TimestampISO;
  readonly fileSize: string;
  readonly fileSizeBytes: number;
  readonly success: true;
}

export interface ClaudeConfigErrorResponse {
  readonly error: string;
  readonly timestamp: TimestampISO;
  readonly success: false;
}

export type ApiResponse = ClaudeConfigResponse | ClaudeConfigErrorResponse;

// Type guards for runtime type checking
export function isConfigError(value: unknown): value is ConfigError {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export function isSuccessResponse(response: ApiResponse): response is ClaudeConfigResponse {
  return response.success === true;
}

export function isErrorResponse(response: ApiResponse): response is ClaudeConfigErrorResponse {
  return response.success === false;
}

export function isValidServerType(value: string): value is ServerTypeValue {
  return Object.values(ServerType).includes(value as ServerTypeValue);
}

// Utility functions for type creation
export function createServerName(name: string): ServerName {
  if (!name || name.trim().length === 0) {
    throw new Error('Server name cannot be empty');
  }
  return name.trim() as ServerName;
}

export function createProjectPath(path: string): ProjectPath {
  if (!path || path.trim().length === 0) {
    throw new Error('Project path cannot be empty');
  }
  return path.trim() as ProjectPath;
}

export function createNonEmptyString(value: string): NonEmptyString {
  if (!value || value.trim().length === 0) {
    throw new Error('String cannot be empty');
  }
  return value.trim() as NonEmptyString;
}

export function createTimestamp(): TimestampISO {
  return new Date().toISOString() as TimestampISO;
}

// Advanced utility types for component props
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Hook return types with proper error handling
export interface UseClaudeConfigReturn {
  readonly state: ConfigPageState;
  readonly refreshConfig: () => Promise<void>;
  readonly isLoading: boolean;
  readonly error: ConfigError | null;
  readonly config: ClaudeConfig | null;
  readonly stats: ClaudeConfigStats | null;
}

// Theme-related types for consistent styling
export interface ThemeColors {
  readonly primary: string;
  readonly secondary: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly info: string;
}

export interface ServerTypeTheme {
  readonly [ServerType.NPX]: ThemeColors['warning'];
  readonly [ServerType.DOCKER]: ThemeColors['info'];
  readonly [ServerType.PYTHON]: ThemeColors['success'];
  readonly [ServerType.NODE]: ThemeColors['secondary'];
  readonly [ServerType.BINARY]: ThemeColors['primary'];
}

// Export all types for use in components
export default ClaudeConfig;