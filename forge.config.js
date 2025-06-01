const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'TaskMaster',
    appBundleId: 'com.taskmaster.desktop',
    appCategoryType: 'public.app-category.productivity',
    protocols: [
      {
        name: 'TaskMaster Protocol',
        schemes: ['taskmaster']
      }
    ],
    // Icons will be added here after creation
    // icon: './assets/icon', // Path without extension, forge handles platform-specific formats
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'TaskMaster',
        authors: 'TaskMaster Team',
        description: 'TaskMaster Desktop - Advanced Task Management',
        setupIcon: './assets/icon.ico', // Will be created
        loadingGif: './assets/loading.gif', // Optional
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        icon: './assets/icon.icns', // Will be created
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'TaskMaster Team',
          homepage: 'https://github.com/taskmaster/taskmaster-ui',
          icon: './assets/icon.png', // Will be created
          description: 'TaskMaster Desktop - Advanced Task Management Application',
          categories: ['Office', 'ProjectManagement'],
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          maintainer: 'TaskMaster Team',
          homepage: 'https://github.com/taskmaster/taskmaster-ui',
          icon: './assets/icon.png', // Will be created
          description: 'TaskMaster Desktop - Advanced Task Management Application',
          categories: ['Office', 'ProjectManagement'],
        }
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Vite plugin for building the renderer process
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'electron/main.ts',
            config: 'vite.main.config.ts',
            target: 'main',
          },
          {
            entry: 'electron/preload.ts',
            config: 'vite.preload.config.ts',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.config.ts',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  // Publisher configuration for auto-updater
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'taskmaster',
          name: 'taskmaster-ui'
        },
        prerelease: false,
        draft: true
      }
    }
  ],
};
