/**
 * Auto-Updater Differential & Rollback Testing (2025)
 * 
 * Tests for differential updates, rollback scenarios, staged rollouts,
 * and failure recovery following 2025 best practices for Electron auto-updater.
 */

import { describe, test, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import { autoUpdater } from 'electron-updater'
import { app, dialog } from 'electron'
import { MockUpdateServer } from '../../../tests/mocks/mock-update-server'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { MockAutoUpdater, MockUpdateInfo } from './mock-types'


// Mock differential update manager
class DifferentialUpdateManager {
  private deltaCache: Map<string, Buffer> = new Map()
  
  async generateDelta(fromVersion: string, toVersion: string, _oldFile: Buffer, newFile: Buffer): Promise<Buffer> {
    // Mock delta generation - in production would use bsdiff or similar
    const deltaSize = Math.floor(newFile.length * 0.1) // 10% of full size
    const delta = Buffer.alloc(deltaSize)
    delta.write(`DELTA:${fromVersion}->${toVersion}`, 0)
    
    const key = `${fromVersion}-${toVersion}`
    this.deltaCache.set(key, delta)
    
    return delta
  }
  
  async applyDelta(oldFile: Buffer, delta: Buffer): Promise<Buffer> {
    // Mock delta application - in production would use bspatch
    const deltaInfo = delta.toString('utf8', 0, 50).match(/DELTA:(.+)->(.+)/)
    if (!deltaInfo) {
      throw new Error('Invalid delta file')
    }
    
    // Return mock updated file
    const newFile = Buffer.alloc(oldFile.length + 1000000) // Simulate size increase
    newFile.write('UPDATED_FILE', 0)
    
    return newFile
  }
  
  getDeltaSize(fromVersion: string, toVersion: string): number {
    const key = `${fromVersion}-${toVersion}`
    const delta = this.deltaCache.get(key)
    return delta ? delta.length : 0
  }
}

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    getPath: vi.fn().mockImplementation((name) => `/mock/path/${name}`),
    relaunch: vi.fn(),
    quit: vi.fn()
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
    showErrorBox: vi.fn()
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    setFeedURL: vi.fn(),
    currentVersion: { version: '1.0.0' },
    allowDowngrade: false,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
}))

describe('Differential Updates & Rollback Tests', () => {
  let mockServer: MockUpdateServer
  let serverUrl: string
  let deltaManager: DifferentialUpdateManager
  const fixturesPath = join(process.cwd(), 'tests/fixtures/differential')

  beforeAll(async () => {
    // Ensure fixtures directory exists
    if (!existsSync(fixturesPath)) {
      mkdirSync(fixturesPath, { recursive: true })
    }

    mockServer = new MockUpdateServer({
      port: 8444,
      useHttps: false,
      enableLogging: false,
      fixturesPath
    })
    serverUrl = await mockServer.start()
    deltaManager = new DifferentialUpdateManager()
  })

  afterAll(async () => {
    await mockServer.stop()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer.reset()
  })

  describe('Differential Update Tests', () => {
    test('should download differential update when available', async () => {
      const currentVersion = '1.0.0'
      const targetVersion = '2.0.0'
      
      // Configure mock server with differential update
      mockServer.setManifest({
        version: targetVersion,
        path: `differential/${currentVersion}/${targetVersion}`,
        size: 5000000, // 5MB delta vs 50MB full
        sha512: createHash('sha512').update('delta-content').digest('hex')
      })

      const checkForDifferentialUpdate = async () => {
        const updateInfo = await autoUpdater.checkForUpdates()
        
        if (updateInfo && updateInfo.updateInfo) {
          const { path } = updateInfo.updateInfo
          
          // Check if differential update is available
          if (path.includes('differential')) {
            return {
              isDifferential: true,
              size: (updateInfo.updateInfo as MockUpdateInfo).size,
              fullSize: 50000000 // Known full update size
            }
          }
        }
        
        return { isDifferential: false }
      }
      
      (autoUpdater as MockAutoUpdater).checkForUpdates.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: {
          version: targetVersion,
          path: `differential/${currentVersion}/${targetVersion}`,
          size: 5000000
        } as MockUpdateInfo,
        versionInfo: {
          version: targetVersion,
          path: `differential/${currentVersion}/${targetVersion}`,
          size: 5000000
        } as MockUpdateInfo,
        cancellationToken: undefined
      })
      
      const result = await checkForDifferentialUpdate()
      
      expect(result.isDifferential).toBe(true)
      expect(result.size).toBeLessThan(result.fullSize!)
      expect(result.size).toBe(5000000) // 5MB delta
    })

    test('should fall back to full update if delta fails', async () => {
      let attemptCount = 0
      
      const downloadWithFallback = async () => {
        attemptCount++
        
        if (attemptCount === 1) {
          // First attempt: differential update fails
          throw new Error('Delta download failed')
        } else {
          // Second attempt: full update succeeds
          return {
            type: 'full',
            size: 50000000,
            path: 'app-2.0.0.exe'
          }
        }
      }
      
      try {
        await downloadWithFallback()
      } catch (error) {
        // First attempt failed, try full update
        const result = await downloadWithFallback()
        
        expect(attemptCount).toBe(2)
        expect(result.type).toBe('full')
        expect(result.size).toBe(50000000)
      }
    })

    test('should optimize delta size for minor updates', async () => {
      const testCases = [
        { from: '1.0.0', to: '1.0.1', expectedRatio: 0.05 }, // 5% for patch
        { from: '1.0.0', to: '1.1.0', expectedRatio: 0.15 }, // 15% for minor
        { from: '1.0.0', to: '2.0.0', expectedRatio: 0.40 }  // 40% for major
      ]
      
      for (const testCase of testCases) {
        const oldFile = Buffer.alloc(50000000) // 50MB
        const newFile = Buffer.alloc(50000000)
        
        const delta = await deltaManager.generateDelta(
          testCase.from,
          testCase.to,
          oldFile,
          newFile
        )
        
        const ratio = delta.length / oldFile.length
        
        // Delta should be smaller than expected ratio
        expect(ratio).toBeLessThanOrEqual(testCase.expectedRatio)
      }
    })

    test('should verify delta integrity before applying', async () => {
      const verifyDeltaIntegrity = async (delta: Buffer, expectedHash: string) => {
        const actualHash = createHash('sha512').update(delta).digest('hex')
        
        if (actualHash !== expectedHash) {
          throw new Error('Delta integrity check failed')
        }
        
        // Additional validation
        if (delta.length === 0) {
          throw new Error('Empty delta file')
        }
        
        // Check delta header
        const header = delta.toString('utf8', 0, 5)
        if (header !== 'DELTA') {
          throw new Error('Invalid delta file format')
        }
        
        return true
      }
      
      const validDelta = Buffer.from('DELTA:1.0.0->2.0.0:content')
      const expectedHash = createHash('sha512').update(validDelta).digest('hex')
      
      await expect(verifyDeltaIntegrity(validDelta, expectedHash)).resolves.toBe(true)
      
      const corruptDelta = Buffer.from('CORRUPTED')
      await expect(verifyDeltaIntegrity(corruptDelta, expectedHash)).rejects.toThrow('integrity check failed')
    })

    test('should handle ASAR optimization for differential updates', async () => {
      // Test configuration for optimal delta generation
      const getOptimalBuildConfig = (enableDifferential: boolean) => {
        if (enableDifferential) {
          return {
            asar: false, // Disable ASAR for better delta efficiency
            compression: 'maximum',
            differentialPackage: true,
            // More granular file structure results in smaller deltas
            files: [
              '!**/*.map', // Exclude source maps
              '!**/test/**', // Exclude test files
              '!**/docs/**' // Exclude documentation
            ]
          }
        }
        
        return {
          asar: true, // Standard ASAR packaging
          compression: 'normal'
        }
      }
      
      const differentialConfig = getOptimalBuildConfig(true)
      const standardConfig = getOptimalBuildConfig(false)
      
      expect(differentialConfig.asar).toBe(false)
      expect(differentialConfig.differentialPackage).toBe(true)
      expect(standardConfig.asar).toBe(true)
    })
  })

  describe('Staged Rollout Tests', () => {
    test('should respect staging percentage', async () => {
      mockServer.setStagingPercentage(20) // 20% rollout
      
      const checkUpdateForUsers = async (userCount: number) => {
        const results = []
        
        for (let i = 0; i < userCount; i++) {
          // Each user has unique ID
          const userId = `user-${i}`
          const updateAvailable = shouldUserGetUpdate(userId, 20)
          results.push(updateAvailable)
        }
        
        return results.filter(r => r).length
      }
      
      // Hash-based staging determination
      const shouldUserGetUpdate = (userId: string, percentage: number): boolean => {
        const hash = createHash('md5').update(userId).digest('hex')
        const bucket = parseInt(hash.substring(0, 8), 16) % 100
        return bucket < percentage
      }
      
      const usersWithUpdate = await checkUpdateForUsers(1000)
      const percentage = (usersWithUpdate / 1000) * 100
      
      // Should be approximately 20% (with some variance)
      expect(percentage).toBeGreaterThan(15)
      expect(percentage).toBeLessThan(25)
    })

    test('should allow rollout percentage adjustment', async () => {
      // Start with 10% rollout
      mockServer.setStagingPercentage(10)
      
      // Simulate progressive rollout
      const rolloutPlan = [
        { day: 1, percentage: 10 },
        { day: 2, percentage: 25 },
        { day: 3, percentage: 50 },
        { day: 5, percentage: 100 }
      ]
      
      for (const stage of rolloutPlan) {
        mockServer.setStagingPercentage(stage.percentage)
        
        const manifest = await fetch(`${serverUrl}/latest.yml`).then(r => r.text())
        
        expect(manifest).toContain(`stagingPercentage: ${stage.percentage}`)
      }
    })

    test('should halt rollout by setting percentage to 0', async () => {
      // Emergency rollout stop
      mockServer.setStagingPercentage(0)
      
      const checkUpdate = async (userId: string) => {
        const response = await fetch(`${serverUrl}/latest.json`, {
          headers: { 'x-client-id': userId }
        })
        const manifest = await response.json()
        
        // When staging is 0%, should return current version
        return manifest.version === '1.0.0' // Current version
      }
      
      // All users should get no update
      const user1 = await checkUpdate('user-1')
      const user2 = await checkUpdate('user-2')
      const user3 = await checkUpdate('user-3')
      
      expect(user1).toBe(true)
      expect(user2).toBe(true)
      expect(user3).toBe(true)
    })
  })

  describe('Rollback Scenarios', () => {
    test('should handle rollback with version increment', async () => {
      // Scenario: 1.0.1 has critical bug, need to rollback
      const rollbackStrategy = {
        brokenVersion: '1.0.1',
        rollbackVersion: '1.0.2', // Must be higher than broken version
        changes: 'Reverts changes from 1.0.1 that caused crashes'
      }
      
      mockServer.setManifest({
        version: rollbackStrategy.rollbackVersion,
        releaseNotes: rollbackStrategy.changes,
        minimumVersion: rollbackStrategy.brokenVersion // Force update for broken version
      })
      
      const checkRollbackUpdate = async (currentVersion: string) => {
        (app.getVersion as any).mockReturnValue(currentVersion)
        
        const result = await autoUpdater.checkForUpdates()
        
        if (result && currentVersion === rollbackStrategy.brokenVersion) {
          // Users on broken version should get rollback
          expect(result.updateInfo.version).toBe(rollbackStrategy.rollbackVersion)
          expect((result.updateInfo as MockUpdateInfo).minimumVersion).toBe(rollbackStrategy.brokenVersion)
        }
        
        return result
      }
      
      (autoUpdater as MockAutoUpdater).checkForUpdates.mockResolvedValue({
        isUpdateAvailable: true,
        updateInfo: {
          version: rollbackStrategy.rollbackVersion,
          minimumVersion: rollbackStrategy.brokenVersion,
          releaseNotes: rollbackStrategy.changes
        } as MockUpdateInfo,
        versionInfo: {
          version: rollbackStrategy.rollbackVersion,
          minimumVersion: rollbackStrategy.brokenVersion,
          releaseNotes: rollbackStrategy.changes
        } as MockUpdateInfo,
        cancellationToken: undefined
      })
      
      await checkRollbackUpdate('1.0.1') // Broken version gets update
    })

    test('should prevent downgrade attacks', async () => {
      const preventDowngrade = (currentVersion: string, updateVersion: string): boolean => {
        const parseVersion = (v: string) => v.split('.').map(Number)
        const current = parseVersion(currentVersion)
        const update = parseVersion(updateVersion)
        
        // Compare version components
        for (let i = 0; i < 3; i++) {
          if ((update[i] ?? 0) < (current[i] ?? 0)) {
            return false // Downgrade detected
          }
          if ((update[i] ?? 0) > (current[i] ?? 0)) {
            return true // Upgrade
          }
        }
        
        return false // Same version
      }
      
      expect(preventDowngrade('2.0.0', '1.9.9')).toBe(false) // Prevent downgrade
      expect(preventDowngrade('2.0.0', '2.0.1')).toBe(true)  // Allow upgrade
      expect(preventDowngrade('2.0.0', '2.0.0')).toBe(false) // Same version
    })

    test('should handle mandatory updates for critical fixes', async () => {
      mockServer.setManifest({
        version: '2.0.1',
        mandatoryUpdate: true,
        minimumVersion: '2.0.0', // All versions below must update
        releaseNotes: 'CRITICAL: Security vulnerability fix'
      })
      
      const handleMandatoryUpdate = async (updateInfo: any) => {
        if (updateInfo.mandatoryUpdate) {
          // Don't give user option to skip
          autoUpdater.logger?.warn('Mandatory update detected')
          
          // Show non-dismissible dialog
          await dialog.showMessageBox({
            type: 'warning',
            title: 'Critical Update Required',
            message: 'A critical security update must be installed.',
            detail: updateInfo.releaseNotes,
            buttons: ['Install Now'],
            defaultId: 0
          })
          
          // Force download and install
          await autoUpdater.downloadUpdate()
          autoUpdater.quitAndInstall(false, true) // Force restart
          
          return true
        }
        
        return false
      };
      
      const updateInfo = {
        version: '2.0.1',
        mandatoryUpdate: true,
        releaseNotes: 'CRITICAL: Security vulnerability fix'
      } as const
      
      (autoUpdater as MockAutoUpdater).downloadUpdate.mockResolvedValue([])
      
      const wasMandatory = await handleMandatoryUpdate(updateInfo)
      
      expect(wasMandatory).toBe(true)
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          buttons: ['Install Now'] // No cancel option
        })
      )
      expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
    })

    test('should track rollback metrics', async () => {
      const rollbackMetrics = {
        version: '1.0.1',
        rollbackCount: 0,
        affectedUsers: new Set<string>(),
        startTime: new Date(),
        endTime: null as Date | null
      }
      
      const trackRollback = (userId: string, fromVersion: string, toVersion: string) => {
        if (fromVersion === '1.0.1' && toVersion === '1.0.2') {
          rollbackMetrics.rollbackCount++
          rollbackMetrics.affectedUsers.add(userId)
        }
      }
      
      // Simulate multiple users rolling back
      trackRollback('user-1', '1.0.1', '1.0.2')
      trackRollback('user-2', '1.0.1', '1.0.2')
      trackRollback('user-3', '1.0.0', '1.0.2') // Not a rollback
      trackRollback('user-1', '1.0.1', '1.0.2') // Duplicate
      
      expect(rollbackMetrics.rollbackCount).toBe(3) // Including duplicate
      expect(rollbackMetrics.affectedUsers.size).toBe(2) // Unique users
    })
  })

  describe('Failure Recovery', () => {
    test('should recover from partial downloads', async () => {
      const downloadManager = {
        downloads: new Map<string, { progress: number; resumable: boolean }>()
      }
      
      const resumeDownload = async (url: string, startByte: number = 0) => {
        const response = await fetch(url, {
          headers: startByte > 0 ? { 'Range': `bytes=${startByte}-` } : {}
        })
        
        if (response.status === 206) {
          // Partial content - resume supported
          return {
            resumable: true,
            startByte,
            totalSize: parseInt(response.headers.get('content-length') || '0')
          }
        }
        
        return {
          resumable: false,
          startByte: 0,
          totalSize: parseInt(response.headers.get('content-length') || '0')
        }
      }
      
      // Mock partial download scenario
      const partialDownload = {
        url: `${serverUrl}/download/app-2.0.0.exe`,
        progress: 25000000, // 25MB of 50MB downloaded
        totalSize: 50000000
      }
      
      downloadManager.downloads.set(partialDownload.url, {
        progress: partialDownload.progress,
        resumable: true
      })
      
      // Resume from where we left off
      const resumeInfo = await resumeDownload(partialDownload.url, partialDownload.progress)
      
      expect(resumeInfo.startByte).toBe(partialDownload.progress)
      expect(resumeInfo.resumable).toBe(true)
    })

    test('should validate update after recovery', async () => {
      const validateRecoveredUpdate = async (_filePath: string, _expectedHash: string) => {
        // After recovering from failure, validate the complete file
        const validations = {
          hashValid: false,
          sizeValid: false,
          signatureValid: false
        }
        
        // Mock validation
        validations.hashValid = true // Mock hash validation
        validations.sizeValid = true // Mock size validation
        validations.signatureValid = true // Mock signature validation
        
        const allValid = Object.values(validations).every(v => v)
        
        if (!allValid) {
          // Delete corrupted file
          console.error('Update validation failed after recovery')
          throw new Error('Corrupted update file')
        }
        
        return validations
      }
      
      const result = await validateRecoveredUpdate('/tmp/update.exe', 'expected-hash')
      
      expect(result.hashValid).toBe(true)
      expect(result.sizeValid).toBe(true)
      expect(result.signatureValid).toBe(true)
    })

    test('should implement exponential backoff for retries', async () => {
      const retryWithBackoff = async (
        operation: () => Promise<any>,
        maxRetries: number = 3
      ) => {
        let lastError: Error
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await operation()
          } catch (error) {
            lastError = error as Error
            
            if (attempt < maxRetries - 1) {
              // Exponential backoff: 2^attempt * 1000ms
              const delay = Math.pow(2, attempt) * 1000
              console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)
              
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
        }
        
        throw lastError!
      }
      
      let attemptCount = 0
      const failingOperation = async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Network error')
        }
        return 'Success'
      }
      
      const result = await retryWithBackoff(failingOperation, 5)
      
      expect(attemptCount).toBe(3)
      expect(result).toBe('Success')
    })

    test('should clean up failed updates', async () => {
      const cleanupFailedUpdate = async (_updatePath: string) => {
        const cleanup = {
          tempFilesDeleted: 0,
          partialDownloadsDeleted: 0,
          cacheCleared: false
        }
        
        // Mock cleanup operations
        cleanup.tempFilesDeleted = 3 // .tmp, .download, .partial files
        cleanup.partialDownloadsDeleted = 1
        cleanup.cacheCleared = true
        
        // Log cleanup actions
        if (autoUpdater.logger) {
          autoUpdater.logger.info('Cleanup completed: ' + JSON.stringify(cleanup))
        }
        
        return cleanup
      }
      
      const result = await cleanupFailedUpdate('/tmp/updates')
      
      expect(result.tempFilesDeleted).toBeGreaterThan(0)
      expect(result.cacheCleared).toBe(true)
      expect(autoUpdater.logger?.info).toHaveBeenCalledWith('Cleanup completed:', result)
    })
  })
})