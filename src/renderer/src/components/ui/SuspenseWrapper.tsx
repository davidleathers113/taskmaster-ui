import React, { Suspense, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Zap } from 'lucide-react';

interface SuspenseWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'app' | 'component' | 'route';
  name?: string;
}

const LoadingSpinner: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    }}
    className="text-primary"
  >
    <Loader2 size={size} />
  </motion.div>
);

const _ComponentLevelFallback: React.FC<{ name?: string }> = ({ name }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.2 }}
    className="flex items-center justify-center p-8 min-h-32 bg-card/50 rounded-lg border border-border/50"
  >
    <div className="flex flex-col items-center gap-3">
      <LoadingSpinner size={20} />
      <span className="text-sm text-muted-foreground">
        {name ? `Loading ${name}...` : 'Loading...'}
      </span>
    </div>
  </motion.div>
);

const _RouteLevelFallback: React.FC<{ name?: string }> = ({ name }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col items-center justify-center min-h-96 p-8"
  >
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <LoadingSpinner size={32} />
        
        {/* Decorative elements */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="absolute -top-2 -right-2"
        >
          <Zap size={16} className="text-yellow-500" />
        </motion.div>
      </div>
      
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {name ? `Loading ${name}` : 'Loading Page'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Please wait while we prepare everything for you
        </p>
      </div>
      
      {/* Loading progress bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 2, ease: "easeInOut" }}
        className="h-1 bg-primary/20 rounded-full overflow-hidden w-48"
      >
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
        />
      </motion.div>
    </div>
  </motion.div>
);

const _AppLevelFallback: React.FC<{ name?: string }> = ({ name }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
    {/* Animated background elements */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -right-1/2 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-full blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-1/2 -left-1/2 w-96 h-96 bg-gradient-to-tr from-emerald-400/10 to-cyan-600/10 rounded-full blur-3xl"
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />
    </div>

    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative flex flex-col items-center justify-center min-h-screen p-8"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo or brand */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
            <Zap size={40} className="text-primary-foreground" />
          </div>
          
          {/* Pulsing effect */}
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute inset-0 bg-primary/20 rounded-2xl"
          />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
            TaskMaster
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md">
            {name ? `Loading ${name}...` : 'Initializing the most beautiful task management experience'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <LoadingSpinner size={40} />
          
          {/* Loading steps */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="text-sm text-muted-foreground"
          >
            Preparing your workspace...
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  </div>
);

export const SuspenseWrapper: React.FC<SuspenseWrapperProps> = ({
  children,
  fallback,
  level = 'component',
  name,
}) => {
  const getFallbackComponent = () => {
    if (fallback) return fallback;
    
    switch (level) {
      case 'app':
        return <_AppLevelFallback name={name} />;
      case 'route':
        return <_RouteLevelFallback name={name} />;
      case 'component':
      default:
        return <_ComponentLevelFallback name={name} />;
    }
  };

  return (
    <Suspense fallback={getFallbackComponent()}>
      {children}
    </Suspense>
  );
};

// Convenience wrapper for lazy-loaded components
export const withSuspense = <P extends object>(
  Component: React.ComponentType<P>,
  suspenseProps?: Omit<SuspenseWrapperProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <SuspenseWrapper {...suspenseProps}>
      <Component {...props} />
    </SuspenseWrapper>
  );

  WrappedComponent.displayName = `withSuspense(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

export default SuspenseWrapper;