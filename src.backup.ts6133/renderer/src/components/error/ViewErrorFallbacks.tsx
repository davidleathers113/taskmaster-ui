import React from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  List, 
  Calendar, 
  BarChart3, 
  Kanban,
  Clock,
  Home,
  Bug,
  FileX
} from 'lucide-react';

interface ViewErrorFallbackProps {
  onRetry?: () => void;
  onGoHome?: () => void;
  onReload?: () => void;
  error?: Error;
  errorId?: string;
  retryCount?: number;
  maxRetries?: number;
}

// Base fallback component with shared functionality
const BaseViewErrorFallback: React.FC<ViewErrorFallbackProps & {
  title: string;
  description: string;
  icon: React.ReactNode;
  suggestions: string[];
  primaryAction?: { label: string; action: () => void; variant?: 'primary' | 'secondary' };
}> = ({ 
  title, 
  description, 
  icon, 
  suggestions, 
  primaryAction,
  onRetry, 
  onGoHome, 
  onReload,
  error,
  errorId,
  retryCount = 0,
  maxRetries = 3
}) => {
  const canRetry = retryCount < maxRetries;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center h-full p-8 text-center bg-card/50 rounded-lg border border-border/50 backdrop-blur-sm"
    >
      {/* Error Icon */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="w-16 h-16 mx-auto text-destructive/80 mb-4"
          >
            {icon}
          </motion.div>
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive/20 rounded-full flex items-center justify-center"
          >
            <AlertTriangle size={16} className="text-destructive" />
          </motion.div>
        </div>
      </motion.div>

      {/* Error Content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 max-w-md"
      >
        <h3 className="text-xl font-semibold text-foreground">
          {title}
        </h3>
        
        <p className="text-muted-foreground">
          {description}
        </p>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="text-left bg-muted/30 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-sm mb-2 text-foreground">
              Try these solutions:
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && error && (
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-left bg-muted/50 rounded-lg p-4 mt-4"
          >
            <summary className="cursor-pointer font-medium text-sm mb-2 flex items-center gap-2">
              <Bug size={16} />
              Error Details (Development)
            </summary>
            <pre className="text-xs text-destructive overflow-auto max-h-32 whitespace-pre-wrap">
              {error.name}: {error.message}
              {errorId && `\nError ID: ${errorId}`}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </motion.details>
        )}

        {/* Retry info */}
        {retryCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground"
          >
            Retry attempt: {retryCount}/{maxRetries}
          </motion.p>
        )}
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap gap-3 mt-8"
      >
        {primaryAction && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={primaryAction.action}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              primaryAction.variant === 'secondary'
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {primaryAction.label}
          </motion.button>
        )}

        {canRetry && onRetry && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={16} />
            Try Again
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
        >
          <RefreshCw size={16} />
          Reload View
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onGoHome}
          className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/90 transition-colors"
        >
          <Home size={16} />
          Go Home
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

// TaskListView Error Fallback
export const TaskListErrorFallback: React.FC<ViewErrorFallbackProps> = (props) => (
  <BaseViewErrorFallback
    {...props}
    title="Task List View Error"
    description="The task list couldn't be displayed due to an unexpected error. Your tasks are safe and will reappear when the issue is resolved."
    icon={<List size={64} />}
    suggestions={[
      "Check if you have any tasks that might contain invalid data",
      "Try switching to a different view (Kanban, Calendar) and back",
      "Refresh the page to reload all task data",
      "Check your internet connection if syncing with remote data"
    ]}
    primaryAction={{
      label: "Switch to Kanban View",
      action: () => {
        // This would be passed down from parent to switch views
        window.location.hash = '#kanban';
      },
      variant: 'secondary'
    }}
  />
);

// KanbanView Error Fallback
export const KanbanErrorFallback: React.FC<ViewErrorFallbackProps> = (props) => (
  <BaseViewErrorFallback
    {...props}
    title="Kanban Board Error"
    description="The kanban board couldn't render properly. This might be due to issues with task categorization or drag-and-drop functionality."
    icon={<Kanban size={64} />}
    suggestions={[
      "Verify that all tasks have valid status values",
      "Try switching to List View to see your tasks",
      "Check if any tasks have circular dependencies",
      "Disable any browser extensions that might interfere with drag-and-drop"
    ]}
    primaryAction={{
      label: "Switch to List View",
      action: () => {
        window.location.hash = '#list';
      },
      variant: 'secondary'
    }}
  />
);

// AnalyticsView Error Fallback
export const AnalyticsErrorFallback: React.FC<ViewErrorFallbackProps> = (props) => (
  <BaseViewErrorFallback
    {...props}
    title="Analytics View Error"
    description="Unable to generate analytics and charts. This could be due to data processing issues or chart rendering problems."
    icon={<BarChart3 size={64} />}
    suggestions={[
      "Ensure you have sufficient task data for meaningful analytics",
      "Check if any task dates are in invalid formats",
      "Try clearing your browser cache and reloading",
      "Switch to another view while we resolve the analytics issue"
    ]}
    primaryAction={{
      label: "View Tasks Instead",
      action: () => {
        window.location.hash = '#list';
      },
      variant: 'secondary'
    }}
  />
);

// CalendarView Error Fallback
export const CalendarErrorFallback: React.FC<ViewErrorFallbackProps> = (props) => (
  <BaseViewErrorFallback
    {...props}
    title="Calendar View Error"
    description="The calendar couldn't display your tasks. This might be related to date processing or calendar rendering issues."
    icon={<Calendar size={64} />}
    suggestions={[
      "Check if your tasks have valid due dates",
      "Verify that task dates are in the correct format",
      "Try viewing tasks without dates in the List view",
      "Check your system's date and time settings"
    ]}
    primaryAction={{
      label: "Switch to Timeline",
      action: () => {
        window.location.hash = '#timeline';
      },
      variant: 'secondary'
    }}
  />
);

// TimelineView Error Fallback
export const TimelineErrorFallback: React.FC<ViewErrorFallbackProps> = (props) => (
  <BaseViewErrorFallback
    {...props}
    title="Timeline View Error"
    description="The timeline couldn't be rendered. This could be due to issues with task sequencing or timeline calculations."
    icon={<Clock size={64} />}
    suggestions={[
      "Verify that tasks have valid start and end dates",
      "Check for any circular task dependencies",
      "Try viewing individual tasks in List view",
      "Ensure task durations are reasonable"
    ]}
    primaryAction={{
      label: "Switch to Calendar",
      action: () => {
        window.location.hash = '#calendar';
      },
      variant: 'secondary'
    }}
  />
);

// Generic fallback for unknown views
export const GenericViewErrorFallback: React.FC<ViewErrorFallbackProps & { viewType?: string }> = ({ 
  viewType, 
  ...props 
}) => (
  <BaseViewErrorFallback
    {...props}
    title={`${viewType || 'View'} Error`}
    description="This view encountered an unexpected error. Please try refreshing or switching to a different view."
    icon={<FileX size={64} />}
    suggestions={[
      "Try refreshing the page",
      "Switch to a different view",
      "Check the browser console for more details",
      "Report this issue if it continues to occur"
    ]}
    primaryAction={{
      label: "Go to List View",
      action: () => {
        window.location.hash = '#list';
      },
      variant: 'secondary'
    }}
  />
);

// Export all fallback components
export {
  BaseViewErrorFallback
};

// Utility function to get the appropriate fallback component
export function getViewErrorFallback(viewType: string): React.FC<ViewErrorFallbackProps> {
  switch (viewType) {
    case 'list':
    case 'taskList':
      return TaskListErrorFallback;
    case 'kanban':
      return KanbanErrorFallback;
    case 'analytics':
      return AnalyticsErrorFallback;
    case 'calendar':
      return CalendarErrorFallback;
    case 'timeline':
      return TimelineErrorFallback;
    default:
      return (props) => <GenericViewErrorFallback {...props} viewType={viewType} />;
  }
}