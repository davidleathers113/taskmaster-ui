# Electron Auto-Updater Testing Methodologies 2025

## Executive Summary

This document outlines comprehensive testing methodologies for Electron auto-updater functionality based on the latest 2025 best practices, security requirements, and industry standards. It addresses critical security vulnerabilities, provides testing strategies, and establishes a robust implementation plan.

## Table of Contents

1. [Critical Security Considerations](#critical-security-considerations)
2. [Testing Infrastructure](#testing-infrastructure)
3. [Mock Update Server Setup](#mock-update-server-setup)
4. [Testing Strategies](#testing-strategies)
5. [CI/CD Integration](#cicd-integration)
6. [Differential Updates](#differential-updates)
7. [Rollback and Failure Scenarios](#rollback-and-failure-scenarios)
8. [Implementation Plan](#implementation-plan)

## Critical Security Considerations

### Known Vulnerabilities

⚠️ **CRITICAL**: electron-updater has a known signature validation bypass vulnerability that can lead to Remote Code Execution (RCE). The signature verification is based on a simple string comparison between the installed binary's `publisherName` and the certificate's Common Name attribute.

### Security Best Practices for 2025

1. **Consider Alternative Solutions**: Due to security concerns with electron-updater, consider:
   - **Electron Forge**: Well-maintained alternative using built-in Squirrel framework
   - **Custom implementation**: Using Electron's native autoUpdater module with additional security layers

2. **Update Server Hardening**:
   - Implement comprehensive access controls
   - Enable monitoring and alerting for suspicious activities
   - Use principle of least privilege for update server access

3. **TLS Certificate Validation**:
   - Enforce TLS certificate validation
   - Implement certificate pinning for update server connections
   - Use HTTPS exclusively for update channels

4. **Code Signing Requirements** (2025 Standards):
   - **Windows**: Extended Validation (EV) certificates required (since June 2023)
   - **macOS**: Notarization required for all distributed apps
   - **Timestamp**: Always timestamp signatures for long-term validity

## Testing Infrastructure

### Local Development Testing

1. **dev-app-update.yml Configuration**:
```yaml
# Place in project root for local testing
owner: your-org-name
repo: dev-auto-update-testing
provider: github

# For custom update server testing
provider: generic
url: http://localhost:8080/updates
```

2. **Minio Local Server Setup**:
```javascript
// test/mocks/update-server.js
const Minio = require('minio')
const express = require('express')
const app = express()

// Configure Minio client for local S3-compatible storage
const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
})

// Serve update files
app.use('/updates', express.static('test/fixtures/updates'))
```

3. **Logging Configuration**:
```javascript
// Enable comprehensive logging for debugging
autoUpdater.logger = require('electron-log')
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.logger.transports.console.level = 'debug'
```

## Mock Update Server Setup

### Test Update Server Implementation

```javascript
// test/mocks/mock-update-server.js
import express from 'express'
import { createServer } from 'https'
import { readFileSync } from 'fs'
import path from 'path'

export class MockUpdateServer {
  constructor(options = {}) {
    this.app = express()
    this.port = options.port || 8443
    this.baseUrl = `https://localhost:${this.port}`
    this.updateManifest = options.manifest || {}
    this.setupRoutes()
  }

  setupRoutes() {
    // Serve latest.yml for Windows/Linux
    this.app.get('/latest.yml', (req, res) => {
      res.type('yaml').send(this.generateManifest('yml'))
    })

    // Serve latest-mac.yml for macOS
    this.app.get('/latest-mac.yml', (req, res) => {
      res.type('yaml').send(this.generateMacManifest())
    })

    // Serve update files
    this.app.get('/download/:filename', (req, res) => {
      const filePath = path.join(this.fixturesPath, req.params.filename)
      res.sendFile(filePath)
    })

    // Differential update endpoint
    this.app.get('/differential/:fromVersion/:toVersion', (req, res) => {
      const deltaPath = this.generateDifferentialUpdate(
        req.params.fromVersion,
        req.params.toVersion
      )
      res.sendFile(deltaPath)
    })
  }

  generateManifest(format) {
    const manifest = {
      version: this.updateManifest.version || '2.0.0',
      releaseDate: new Date().toISOString(),
      path: `download/app-${this.updateManifest.version}.exe`,
      sha512: this.updateManifest.sha512 || 'mock-sha512-hash',
      size: this.updateManifest.size || 50000000,
      stagingPercentage: this.updateManifest.stagingPercentage || 100
    }
    
    return format === 'yml' ? this.toYaml(manifest) : manifest
  }

  start() {
    const httpsOptions = {
      key: readFileSync('test/fixtures/certs/server.key'),
      cert: readFileSync('test/fixtures/certs/server.crt')
    }
    
    this.server = createServer(httpsOptions, this.app)
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`Mock update server running at ${this.baseUrl}`)
        resolve(this.baseUrl)
      })
    })
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(resolve)
    })
  }
}
```

## Testing Strategies

### 1. Basic Update Flow Testing

```javascript
// test/auto-updater/basic-flow.test.js
import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { autoUpdater } from 'electron-updater'
import { MockUpdateServer } from '../mocks/mock-update-server'

describe('Auto Updater Basic Flow', () => {
  let mockServer
  let app

  beforeEach(async () => {
    mockServer = new MockUpdateServer({
      manifest: {
        version: '2.0.0',
        stagingPercentage: 100
      }
    })
    await mockServer.start()
    
    // Configure auto-updater for testing
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.autoDownload = false
    autoUpdater.updateConfigPath = 'test/fixtures/dev-app-update.yml'
  })

  afterEach(async () => {
    await mockServer.stop()
  })

  it('should check for updates successfully', async () => {
    const updateCheckResult = await autoUpdater.checkForUpdates()
    
    expect(updateCheckResult).toBeDefined()
    expect(updateCheckResult.updateInfo.version).toBe('2.0.0')
  })

  it('should handle network failures gracefully', async () => {
    await mockServer.stop() // Simulate server down
    
    await expect(autoUpdater.checkForUpdates()).rejects.toThrow()
  })

  it('should respect staging percentage', async () => {
    mockServer.updateManifest.stagingPercentage = 10
    
    // Test with multiple user IDs to verify staging
    const results = []
    for (let i = 0; i < 100; i++) {
      const result = await autoUpdater.checkForUpdates()
      results.push(result.updateInfo.available)
    }
    
    const updateCount = results.filter(r => r).length
    expect(updateCount).toBeCloseTo(10, 5) // ~10% should get update
  })
})
```

### 2. Security Validation Testing

```javascript
// test/auto-updater/security.test.js
import { describe, it, expect } from 'vitest'
import { verifySignature, validateCertificate } from '../utils/security'

describe('Auto Updater Security', () => {
  it('should verify update signature correctly', async () => {
    const updateFile = 'test/fixtures/signed-update.exe'
    const signature = await verifySignature(updateFile)
    
    expect(signature.valid).toBe(true)
    expect(signature.commonName).toBe('TaskMaster Inc.')
  })

  it('should reject updates with invalid signatures', async () => {
    const maliciousUpdate = 'test/fixtures/malicious-update.exe'
    const signature = await verifySignature(maliciousUpdate)
    
    expect(signature.valid).toBe(false)
  })

  it('should validate certificate chain', async () => {
    const cert = await validateCertificate('test/fixtures/certs/update.crt')
    
    expect(cert.isEV).toBe(true) // 2025 requirement
    expect(cert.isExpired).toBe(false)
    expect(cert.chain.length).toBeGreaterThan(1)
  })

  it('should enforce TLS certificate pinning', async () => {
    const pinnedCert = readFileSync('certs/update-server.crt', 'utf8')
    const connection = await testTLSConnection('https://updates.example.com', {
      ca: pinnedCert,
      rejectUnauthorized: true
    })
    
    expect(connection.authorized).toBe(true)
  })
})
```

### 3. Differential Update Testing

```javascript
// test/auto-updater/differential.test.js
describe('Differential Updates', () => {
  it('should generate small deltas for minor changes', async () => {
    // Disable ASAR for differential updates
    const buildConfig = {
      asar: false,
      compression: 'maximum'
    }
    
    const deltaSize = await generateDelta('1.0.0', '1.0.1', buildConfig)
    const fullSize = await getFullUpdateSize('1.0.1')
    
    expect(deltaSize).toBeLessThan(fullSize * 0.3) // Delta should be <30% of full
  })

  it('should fall back to full update on delta failure', async () => {
    mockServer.failDifferentialUpdate = true
    
    const updateInfo = await autoUpdater.checkForUpdates()
    await autoUpdater.downloadUpdate()
    
    expect(updateInfo.downloadedFile).toContain('full-update')
  })
})
```

### 4. Rollback Testing

```javascript
// test/auto-updater/rollback.test.js
describe('Update Rollback Scenarios', () => {
  it('should handle rollback with incremented version', async () => {
    // Simulate broken 1.0.1 release
    mockServer.updateManifest = {
      version: '1.0.2', // Must increment for users on broken 1.0.1
      releaseNotes: 'Fixes critical bug in 1.0.1'
    }
    
    const result = await autoUpdater.checkForUpdates()
    expect(result.updateInfo.version).toBe('1.0.2')
  })

  it('should support staged rollout rollback', async () => {
    // Start with 10% rollout
    mockServer.updateManifest.stagingPercentage = 10
    
    // Simulate rollback by setting to 0
    mockServer.updateManifest.stagingPercentage = 0
    
    const result = await autoUpdater.checkForUpdates()
    expect(result.updateInfo.available).toBe(false)
  })
})
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/auto-update-test.yml
name: Auto Update Testing

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  test-auto-update:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup code signing (Windows)
        if: matrix.os == 'windows-latest'
        env:
          CERTIFICATE_BASE64: ${{ secrets.WINDOWS_CERTIFICATE }}
        run: |
          echo $CERTIFICATE_BASE64 | base64 -d > certificate.pfx
          # Use cloud-based signing service
          npm install -g @electron/windows-sign
      
      - name: Setup code signing (macOS)
        if: matrix.os == 'macos-latest'
        env:
          CERTIFICATE_BASE64: ${{ secrets.MACOS_CERTIFICATE }}
          CERTIFICATE_PASSWORD: ${{ secrets.MACOS_CERTIFICATE_PASSWORD }}
        run: |
          echo $CERTIFICATE_BASE64 | base64 -d > certificate.p12
          security create-keychain -p actions temp.keychain
          security import certificate.p12 -k temp.keychain -P $CERTIFICATE_PASSWORD
      
      - name: Run auto-update tests
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
        run: npm run test:auto-update
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-logs-${{ matrix.os }}
          path: |
            test-results/
            logs/
```

## Differential Updates

### Best Practices for 2025

1. **File Structure Optimization**:
   - Disable ASAR packaging for better delta generation
   - Use granular file structure
   - Implement proper compression settings

2. **Configuration**:
```javascript
// electron-builder.config.js
module.exports = {
  asar: false, // Required for efficient differential updates
  compression: 'maximum',
  differentialPackage: true,
  electronUpdaterCompatibility: '>=2.16' // Use latest format
}
```

3. **Testing Differential Updates**:
```javascript
// Ensure download-progress events work
autoUpdater.on('download-progress', (progress) => {
  console.log(`Downloaded ${progress.percent}%`)
  // Note: May not fire for differential updates on some platforms
})
```

## Rollback and Failure Scenarios

### Staged Rollout Strategy

```yaml
# latest.yml with staged rollout
version: 2.0.0
stagingPercentage: 10  # Start with 10% of users
releaseDate: '2025-01-15T10:00:00Z'
```

### Rollback Procedures

1. **Version Increment Required**: Always increment version for rollback
2. **Staging Percentage**: Set to 0 to halt rollout
3. **Force Update**: Use `mandatoryUpdate: true` for critical fixes

### Error Handling

```javascript
// Comprehensive error handling
class AutoUpdateManager {
  constructor() {
    this.setupErrorHandlers()
  }

  setupErrorHandlers() {
    autoUpdater.on('error', (error) => {
      if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
        this.handleNetworkError(error)
      } else if (error.message.includes('ENOSPC')) {
        this.handleDiskSpaceError(error)
      } else if (error.message.includes('signature')) {
        this.handleSignatureError(error)
      }
    })
  }

  async checkForUpdatesWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await autoUpdater.checkForUpdates()
      } catch (error) {
        if (i === maxRetries - 1) throw error
        await this.delay(Math.pow(2, i) * 1000) // Exponential backoff
      }
    }
  }
}
```

## Implementation Plan

### Phase 1: Infrastructure Setup (Week 1)

1. **Set up mock update server**:
   - Implement MockUpdateServer class
   - Create test certificates for HTTPS
   - Set up Minio for local S3 testing

2. **Configure test environment**:
   - Create dev-app-update.yml
   - Set up logging infrastructure
   - Prepare test fixtures and signed binaries

### Phase 2: Core Testing Implementation (Week 2)

1. **Basic update flow tests**:
   - Check for updates
   - Download updates
   - Install updates (with mock)
   - Progress tracking

2. **Security validation tests**:
   - Signature verification
   - Certificate validation
   - TLS pinning tests
   - Vulnerability regression tests

### Phase 3: Advanced Scenarios (Week 3)

1. **Differential update tests**:
   - Delta generation
   - Fallback mechanisms
   - Progress reporting

2. **Failure scenario tests**:
   - Network failures
   - Disk space issues
   - Corrupted updates
   - Signature mismatches

### Phase 4: CI/CD Integration (Week 4)

1. **Pipeline setup**:
   - GitHub Actions configuration
   - Code signing integration
   - Multi-platform testing matrix

2. **Monitoring and reporting**:
   - Test result aggregation
   - Performance metrics
   - Security scan integration

### Phase 5: Documentation and Training (Week 5)

1. **Documentation**:
   - Update testing guide
   - Security best practices
   - Troubleshooting guide

2. **Team training**:
   - Security awareness
   - Testing procedures
   - Incident response

## Monitoring and Metrics

### Key Metrics to Track

1. **Update Success Rate**: Track successful vs failed updates
2. **Download Performance**: Monitor download speeds and timeouts
3. **Delta Efficiency**: Compare differential vs full update sizes
4. **Security Events**: Log signature validation failures
5. **Rollback Frequency**: Monitor how often rollbacks are needed

### Logging Strategy

```javascript
// Comprehensive logging setup
const log = require('electron-log')

// Configure log rotation
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
log.transports.file.archiveLog = (file) => {
  file = file.toString()
  const info = path.parse(file)
  return path.join(info.dir, `${info.name}.${Date.now()}${info.ext}`)
}

// Log all auto-updater events
Object.keys(autoUpdater.events).forEach(event => {
  autoUpdater.on(event, (...args) => {
    log.info(`AutoUpdater Event: ${event}`, ...args)
  })
})
```

## Conclusion

This comprehensive testing approach for Electron auto-updater functionality addresses the critical security concerns, provides robust testing strategies, and ensures reliable update delivery in production environments. The emphasis on security, particularly around signature validation and certificate management, is crucial given the known vulnerabilities in the ecosystem.

Regular review and updates of these testing methodologies will be necessary as the Electron ecosystem evolves and new security threats emerge.