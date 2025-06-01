import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { SuspenseWrapper } from './components/ui/SuspenseWrapper'
import './styles/globals.css'

// Error handler for app-level errors
const handleAppError = (error: Error, errorInfo: React.ErrorInfo) => {
  // In development, log detailed error information
  if (process.env.NODE_ENV === 'development') {
    console.group('🚨 App-Level Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.groupEnd();
  }
  
  // In production, you might want to send this to an error reporting service
  // Example: Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === 'production') {
    // reportToErrorService(error, errorInfo);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary 
      level="app" 
      onError={handleAppError}
    >
      <SuspenseWrapper 
        level="app" 
        name="TaskMaster Application"
      >
        <App />
      </SuspenseWrapper>
    </ErrorBoundary>
  </React.StrictMode>,
)