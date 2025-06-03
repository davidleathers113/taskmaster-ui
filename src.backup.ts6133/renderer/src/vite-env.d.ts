/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
  readonly hot?: {
    readonly data: any
    accept(): void
    accept(cb: (mod: any) => void): void
    accept(dep: string, cb: (mod: any) => void): void
    accept(deps: string[], cb: (modules: any[]) => void): void
    dispose(cb: (data: any) => void): void
    decline(): void
    invalidate(): void
    on(event: string, cb: (...args: any[]) => void): void
  }
}

declare global {
  interface Window {
    electronAPI: {
      // App information APIs
      getVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      getAppDataPath: () => Promise<string>
      
      // File system APIs
      getDocumentsPath: () => Promise<string>
      
      // Dialog APIs
      showError: (title: string, content: string) => Promise<void>
      
      // Auto-updater APIs
      onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void
      removeDownloadProgressListener: () => void
      
      // Backup APIs
      saveBackup?: (key: string, data: any, basePath: string) => Promise<void>
      loadBackup?: (key: string, basePath: string) => Promise<any>
      deleteBackup?: (key: string, basePath: string) => Promise<void>
      listBackups?: (basePath: string) => Promise<string[]>
      
      // Development flag
      isDev: boolean
    }
  }
}

export {}