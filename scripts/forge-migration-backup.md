# Electron Forge Configuration Backup

> This document captures the Electron Forge configuration before migration to electron-vite.
> Created during Task 2: Remove Electron Forge Configuration

## Removed Packages (package.json devDependencies)

```json
{
  "@electron-forge/cli": "^7.8.1",
  "@electron-forge/maker-deb": "^7.8.1", 
  "@electron-forge/maker-rpm": "^7.8.1",
  "@electron-forge/maker-squirrel": "^7.8.1",
  "@electron-forge/maker-zip": "^7.8.1",
  "@electron-forge/plugin-auto-unpack-natives": "^7.8.1",
  "@electron-forge/plugin-fuses": "^7.8.1",
  "@electron-forge/plugin-vite": "^7.8.1",
  "@electron-forge/publisher-github": "^7.8.1"
}
```

## Removed Package (dependencies)

```json
{
  "electron-squirrel-startup": "^1.0.1"
}
```

## Removed Scripts (package.json)

```json
{
  "start": "NODE_OPTIONS=\"--no-deprecation\" electron-forge start",
  "package": "NODE_OPTIONS=\"--no-deprecation\" electron-forge package", 
  "make": "NODE_OPTIONS=\"--no-deprecation\" electron-forge make"
}
```

## forge.config.js Configuration

### Packager Config
- **executableName**: 'TaskMaster'
- **appBundleId**: 'com.taskmaster.desktop' 
- **appCategoryType**: 'public.app-category.productivity'
- **protocols**: TaskMaster Protocol (taskmaster://)
- **asar**: true

### Makers Configuration

#### Windows (Squirrel)
- **name**: 'TaskMaster'
- **authors**: 'TaskMaster Team'
- **description**: 'TaskMaster Desktop - Advanced Task Management'
- **setupIcon**: './assets/icon.ico'
- **loadingGif**: './assets/loading.gif'

#### macOS (ZIP)
- **platforms**: ['darwin']
- **icon**: './assets/icon.icns'

#### Linux (DEB)
- **maintainer**: 'TaskMaster Team'
- **homepage**: 'https://github.com/taskmaster/taskmaster-ui'
- **icon**: './assets/icon.png'
- **description**: 'TaskMaster Desktop - Advanced Task Management Application'
- **categories**: ['Office', 'ProjectManagement']

#### Linux (RPM)
- Same configuration as DEB

### Plugins Configuration

#### Auto Unpack Natives Plugin
- Empty config

#### Vite Plugin
- **Main Process**: entry: 'electron/main.ts', config: 'vite.main.config.ts'
- **Preload**: entry: 'electron/preload.ts', config: 'vite.preload.config.ts'
- **Renderer**: name: 'main_window', config: 'vite.config.ts'

#### Fuses Plugin (Security)
- **RunAsNode**: false
- **EnableCookieEncryption**: true
- **EnableNodeOptionsEnvironmentVariable**: false
- **EnableNodeCliInspectArguments**: false
- **EnableEmbeddedAsarIntegrityValidation**: true
- **OnlyLoadAppFromAsar**: true

### Publishers Configuration

#### GitHub Publisher
- **owner**: 'taskmaster'
- **name**: 'taskmaster-ui'
- **prerelease**: false
- **draft**: true

## Migration Notes for electron-vite

1. **Packaging**: Need to configure electron-builder or similar for packaging
2. **Security**: Migrate Fuses configuration to electron-vite setup
3. **Distribution**: Set up GitHub releases manually or with GitHub Actions
4. **Icons**: Preserve icon configuration across platforms
5. **App Metadata**: Preserve app bundle ID, categories, and protocol handling

## Files Removed
- forge.config.js

## References Found
- package.json (devDependencies and dependencies)
- package-lock.json (dependency tree)
- forge.config.js (main configuration)