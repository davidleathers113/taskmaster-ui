/**
 * MUI Error Boundary Component (2025)
 * 
 * Advanced error boundary with Material-UI integration for enhanced user feedback.
 * Combines react-error-boundary patterns with MUI components for professional
 * error handling and user interaction.
 * 
 * Features:
 * - MUI Dialog for critical error interaction
 * - MUI Snackbar with Alert for non-intrusive notifications
 * - User feedback collection with MUI forms
 * - Session preservation and state recovery
 * - Integration with ErrorReportingService
 * - Accessibility-compliant error handling
 */

import React, { ErrorInfo, useState, useCallback, useEffect } from 'react';
import { ErrorBoundary as ReactErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  Snackbar,
  Alert,
  AlertTitle,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  Divider,
  Chip,
  IconButton,
  Collapse,
  Stack,
  LinearProgress,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import {
  Close as CloseIcon,
  BugReport as BugReportIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Feedback as FeedbackIcon,
  Restore as RestoreIcon,
  Emergency as EmergencyIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { errorReportingService, ErrorContext, UserFeedback } from '../../services/ErrorReportingService';
import { EnhancedErrorBoundaryProps, ErrorFallbackProps } from './EnhancedErrorBoundary';

// MUI-specific error boundary props
export interface MUIErrorBoundaryProps extends Omit<EnhancedErrorBoundaryProps, 'FallbackComponent'> {
  showDialog?: boolean;
  showSnackbar?: boolean;
  dialogTitle?: string;
  allowUserFeedback?: boolean;
  allowErrorDownload?: boolean;
  muiTheme?: 'light' | 'dark' | 'auto';
  severity?: 'error' | 'warning' | 'info';
  autoHideDuration?: number;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  enableDetailedReporting?: boolean;
}

// User feedback form data
interface FeedbackFormData {
  userEmail: string;
  description: string;
  steps: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'bug' | 'feature' | 'improvement' | 'question';
}

// Error notification state
interface ErrorNotificationState {
  open: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  reportId?: string;
}

/**
 * MUI Error Dialog Component
 */
interface MUIErrorDialogProps {
  open: boolean;
  error: Error;
  errorInfo?: ErrorInfo;
  onClose: () => void;
  onRetry: () => void;
  onReportError: (feedback?: FeedbackFormData) => void;
  onDownloadReport: () => void;
  retryCount?: number;
  maxRetries?: number;
  allowUserFeedback?: boolean;
  allowErrorDownload?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  enableDetailedReporting?: boolean;
}

const _MUIErrorDialog: React.FC<MUIErrorDialogProps> = ({
  open,
  error,
  errorInfo,
  onClose,
  onRetry,
  onReportError,
  onDownloadReport,
  retryCount = 0,
  maxRetries = 3,
  allowUserFeedback = true,
  allowErrorDownload = true,
  maxWidth = 'md',
  enableDetailedReporting = true
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackFormData>({
    userEmail: '',
    description: '',
    steps: '',
    severity: 'medium',
    category: 'bug'
  });

  const canRetry = retryCount < maxRetries;

  const handleFeedbackSubmit = () => {
    onReportError(feedbackData);
    setShowFeedbackForm(false);
    onClose();
  };

  const handleQuickReport = () => {
    onReportError();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      aria-labelledby="error-dialog-title"
      aria-describedby="error-dialog-description"
    >
      <DialogTitle 
        id="error-dialog-title"
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          pr: 1
        }}
      >
        <EmergencyIcon color="error" />
        An Error Occurred
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <DialogContentText id="error-dialog-description" sx={{ mb: 2 }}>
          We're sorry, but something went wrong. Our team has been notified, 
          but you can help us fix this faster by providing additional details.
        </DialogContentText>

        {/* Error Summary */}
        <Card variant="outlined" sx={{ mb: 2, bgcolor: 'error.main', color: 'error.contrastText' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="subtitle2" gutterBottom>
              Error: {error.name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {error.message}
            </Typography>
          </CardContent>
        </Card>

        {/* Retry Information */}
        {retryCount > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Recovery attempt: {retryCount}/{maxRetries}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(retryCount / maxRetries) * 100} 
              sx={{ mt: 1 }}
            />
          </Box>
        )}

        {/* Action Chips */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              icon={<BugReportIcon />}
              label="Report Issue"
              color="primary"
              clickable
              onClick={() => setShowFeedbackForm(true)}
              disabled={!allowUserFeedback}
            />
            {allowErrorDownload && (
              <Chip
                icon={<DownloadIcon />}
                label="Download Report"
                variant="outlined"
                clickable
                onClick={onDownloadReport}
              />
            )}
            {enableDetailedReporting && (
              <Chip
                icon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                label={showDetails ? "Hide Details" : "Show Details"}
                variant="outlined"
                clickable
                onClick={() => setShowDetails(!showDetails)}
              />
            )}
          </Stack>
        </Box>

        {/* Error Details (Collapsible) */}
        <Collapse in={showDetails}>
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Technical Details
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="body2" component="pre" sx={{ 
                whiteSpace: 'pre-wrap',
                fontSize: '0.75rem',
                maxHeight: 200,
                overflow: 'auto',
                fontFamily: 'monospace'
              }}>
                {error.stack}
              </Typography>
              {errorInfo?.componentStack && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Component Stack
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.75rem',
                    maxHeight: 100,
                    overflow: 'auto',
                    fontFamily: 'monospace'
                  }}>
                    {errorInfo.componentStack}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Collapse>

        {/* User Feedback Form */}
        <Collapse in={showFeedbackForm}>
          <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Help Us Fix This Issue
            </Typography>
            
            <Stack spacing={2}>
              <TextField
                label="Your Email (Optional)"
                variant="outlined"
                size="small"
                fullWidth
                value={feedbackData.userEmail}
                onChange={(e) => setFeedbackData(prev => ({ ...prev, userEmail: e.target.value }))}
                placeholder="your.email@example.com"
              />
              
              <TextField
                label="What were you trying to do?"
                variant="outlined"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={feedbackData.description}
                onChange={(e) => setFeedbackData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what you were doing when the error occurred..."
              />
              
              <TextField
                label="Steps to reproduce (Optional)"
                variant="outlined"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={feedbackData.steps}
                onChange={(e) => setFeedbackData(prev => ({ ...prev, steps: e.target.value }))}
                placeholder="1. Click on...\n2. Then...\n3. Error appeared"
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small">
                  <FormLabel>Severity</FormLabel>
                  <RadioGroup
                    row
                    value={feedbackData.severity}
                    onChange={(e) => setFeedbackData(prev => ({ 
                      ...prev, 
                      severity: e.target.value as any 
                    }))}
                  >
                    <FormControlLabel value="low" control={<Radio size="small" />} label="Low" />
                    <FormControlLabel value="medium" control={<Radio size="small" />} label="Medium" />
                    <FormControlLabel value="high" control={<Radio size="small" />} label="High" />
                  </RadioGroup>
                </FormControl>
              </Box>
            </Stack>
          </Card>
        </Collapse>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {showFeedbackForm ? (
          <>
            <Button onClick={() => setShowFeedbackForm(false)}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleFeedbackSubmit}
              disabled={!feedbackData.description.trim()}
            >
              Submit Feedback
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} color="inherit">
              Dismiss
            </Button>
            {allowUserFeedback && (
              <Button onClick={handleQuickReport} color="primary">
                <FeedbackIcon sx={{ mr: 1 }} />
                Quick Report
              </Button>
            )}
            {canRetry && (
              <Button 
                variant="contained" 
                onClick={onRetry}
                color="primary"
                startIcon={<RefreshIcon />}
              >
                Try Again
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

/**
 * MUI Error Snackbar Component
 */
interface MUIErrorSnackbarProps {
  notification: ErrorNotificationState;
  onClose: () => void;
  autoHideDuration?: number;
}

const _MUIErrorSnackbar: React.FC<MUIErrorSnackbarProps> = ({
  notification,
  onClose,
  autoHideDuration = 6000
}) => {
  return (
    <Snackbar
      open={notification.open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert 
        onClose={onClose} 
        severity={notification.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        <AlertTitle>
          {notification.severity === 'error' ? 'Error Reported' : 
           notification.severity === 'success' ? 'Success' : 'Information'}
        </AlertTitle>
        {notification.message}
        {notification.reportId && (
          <Typography variant="caption" display="block" sx={{ mt: 1, opacity: 0.8 }}>
            Report ID: {notification.reportId}
          </Typography>
        )}
      </Alert>
    </Snackbar>
  );
};

/**
 * MUI Error Fallback Component
 */
const _MUIErrorFallback: React.FC<ErrorFallbackProps & MUIErrorBoundaryProps> = ({
  error,
  resetErrorBoundary,
  retryCount = 0,
  maxRetries = 3,
  showDialog = true,
  showSnackbar = false,
  allowUserFeedback = true,
  allowErrorDownload = true,
  maxWidth = 'md',
  enableDetailedReporting = true,
  isolationLevel = 'component'
}) => {
  const [dialogOpen, setDialogOpen] = useState(showDialog);
  const [notification, setNotification] = useState<ErrorNotificationState>({
    open: false,
    message: '',
    severity: 'error'
  });

  const handleRetry = useCallback(() => {
    setDialogOpen(false);
    resetErrorBoundary();
  }, [resetErrorBoundary]);

  const handleReportError = useCallback(async (feedback?: FeedbackFormData) => {
    try {
      const context: Partial<ErrorContext> = {
        userInitiated: true,
        severity: feedback?.severity || 'medium',
        component: 'MUIErrorBoundary',
        action: 'user_report'
      };

      const reportId = await errorReportingService.reportError(error, undefined, context);

      if (feedback && reportId) {
        const userFeedback: Omit<UserFeedback, 'timestamp'> = {
          reportId,
          userEmail: feedback.userEmail || undefined,
          description: feedback.description,
          steps: feedback.steps || undefined,
          severity: feedback.severity,
          category: feedback.category
        };

        await errorReportingService.submitUserFeedback(userFeedback);
      }

      setNotification({
        open: true,
        message: 'Thank you for reporting this issue. We\'ll investigate and get back to you.',
        severity: 'success',
        reportId: reportId || undefined
      });
    } catch (error) {
      console.error('Failed to submit error report:', error);
      setNotification({
        open: true,
        message: 'Failed to submit error report. Please try again later.',
        severity: 'error'
      });
    }
  }, [error]);

  const handleDownloadReport = useCallback(() => {
    try {
      const report = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotification({
        open: true,
        message: 'Error report downloaded successfully.',
        severity: 'success'
      });
    } catch (error) {
      console.error('Failed to download error report:', error);
      setNotification({
        open: true,
        message: 'Failed to download error report.',
        severity: 'error'
      });
    }
  }, [error]);

  const handleNotificationClose = useCallback(() => {
    setNotification(prev => ({ ...prev, open: false }));
  }, []);

  // Auto-show snackbar if configured
  useEffect(() => {
    if (showSnackbar && !showDialog) {
      setNotification({
        open: true,
        message: 'An error occurred. You can continue using the application.',
        severity: 'error'
      });
    }
  }, [showSnackbar, showDialog]);

  return (
    <>
      {/* Error Dialog */}
      <_MUIErrorDialog
        open={dialogOpen}
        error={error}
        onClose={() => setDialogOpen(false)}
        onRetry={handleRetry}
        onReportError={handleReportError}
        onDownloadReport={handleDownloadReport}
        retryCount={retryCount}
        maxRetries={maxRetries}
        allowUserFeedback={allowUserFeedback}
        allowErrorDownload={allowErrorDownload}
        maxWidth={maxWidth}
        enableDetailedReporting={enableDetailedReporting}
      />

      {/* Error Notification */}
      <_MUIErrorSnackbar
        notification={notification}
        onClose={handleNotificationClose}
      />

      {/* Fallback UI if dialog is closed */}
      {!dialogOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center h-full p-8 text-center"
        >
          <Card sx={{ maxWidth: 400, textAlign: 'center', p: 3 }}>
            <CardContent>
              <EmergencyIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {isolationLevel === 'page' ? 'Application Error' : 'Component Error'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {isolationLevel === 'page'
                  ? 'An unexpected error occurred. Please try refreshing the page.'
                  : 'This component encountered an error. Other parts of the app should work normally.'
                }
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: 'center', gap: 1 }}>
              <Button 
                variant="contained" 
                onClick={handleRetry}
                startIcon={<RefreshIcon />}
                disabled={retryCount >= maxRetries}
              >
                Try Again
              </Button>
              <Button 
                variant="outlined"
                onClick={() => setDialogOpen(true)}
                startIcon={<BugReportIcon />}
              >
                Report Issue
              </Button>
            </CardActions>
          </Card>
        </motion.div>
      )}
    </>
  );
};

/**
 * Main MUI Error Boundary Component
 */
export const MUIErrorBoundary: React.FC<MUIErrorBoundaryProps> = ({
  children,
  resetKeys,
  onReset,
  onError,
  showDialog = true,
  showSnackbar = false,
  ...props
}) => {
  const handleError = useCallback((error: Error, errorInfo: ErrorInfo) => {
    // Report error automatically
    errorReportingService.reportError(error, errorInfo, {
      component: 'MUIErrorBoundary',
      action: 'automatic_report',
      severity: 'high'
    });

    // Call custom error handler
    onError?.(error, errorInfo);
  }, [onError]);

  return (
    <ReactErrorBoundary
      FallbackComponent={(fallbackProps) => (
        <_MUIErrorFallback
          {...fallbackProps}
          showDialog={showDialog}
          showSnackbar={showSnackbar}
          {...props}
          children={children}
        />
      )}
      resetKeys={resetKeys}
      onReset={(details) => onReset?.(details)}
      onError={handleError}
    >
      {children}
    </ReactErrorBoundary>
  );
};

/**
 * Hook for using MUI error handling
 */
export const useMUIErrorHandler = () => {
  const { showBoundary } = useErrorBoundary();
  
  const reportError = useCallback((error: Error, context?: Partial<ErrorContext>) => {
    // Add context to error if provided
    if (context) {
      (error as any).__errorContext = context;
    }
    
    showBoundary(error);
  }, [showBoundary]);

  return { reportError };
};

/**
 * Higher-order component wrapper for MUI error boundary
 */
export const withMUIErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<MUIErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <MUIErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </MUIErrorBoundary>
  );

  WrappedComponent.displayName = `withMUIErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};


export default MUIErrorBoundary;