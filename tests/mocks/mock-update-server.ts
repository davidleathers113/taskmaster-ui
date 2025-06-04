/**
 * Mock Update Server (2025)
 * 
 * Comprehensive mock server for testing Electron auto-updater functionality
 * including security validation, differential updates, staged rollouts,
 * and failure scenarios following 2025 best practices.
 */

import express, { Express, Request } from 'express'
import { createServer as createHttpsServer, Server as HttpsServer } from 'https'
import { createServer as createHttpServer, Server as HttpServer } from 'http'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { createHash } from 'crypto'
import yaml from 'yaml'

interface UpdateManifest {
  version: string
  releaseDate?: string
  path?: string
  sha512?: string
  size?: number
  stagingPercentage?: number
  releaseNotes?: string
  minimumVersion?: string
  mandatoryUpdate?: boolean
}

interface MockServerOptions {
  port?: number
  useHttps?: boolean
  manifest?: UpdateManifest
  fixturesPath?: string
  enableLogging?: boolean
  simulateErrors?: boolean
  latency?: number
  certificatePath?: string
  keyPath?: string
}

interface DifferentialUpdate {
  fromVersion: string
  toVersion: string
  deltaPath: string
  size: number
  sha512: string
}

export class MockUpdateServer {
  private app: Express
  private server: HttpsServer | HttpServer | null = null
  private port: number
  private useHttps: boolean
  private baseUrl: string
  private updateManifest: UpdateManifest
  private fixturesPath: string
  private enableLogging: boolean
  private simulateErrors: boolean
  private latency: number
  private differentialUpdates: Map<string, DifferentialUpdate> = new Map()
  private downloadCounts: Map<string, number> = new Map()
  private requestLogs: Array<{ timestamp: Date; method: string; path: string; status: number }> = []

  constructor(options: MockServerOptions = {}) {
    this.app = express()
    this.port = options.port || (options.useHttps ? 8443 : 8080)
    this.useHttps = options.useHttps || false
    this.baseUrl = `${this.useHttps ? 'https' : 'http'}://localhost:${this.port}`
    this.fixturesPath = options.fixturesPath || join(process.cwd(), 'tests/fixtures/updates')
    this.enableLogging = options.enableLogging || false
    this.simulateErrors = options.simulateErrors || false
    this.latency = options.latency || 0
    
    // Ensure fixtures directory exists
    if (!existsSync(this.fixturesPath)) {
      mkdirSync(this.fixturesPath, { recursive: true })
    }

    // Initialize default manifest
    this.updateManifest = {
      version: '2.0.0',
      releaseDate: new Date().toISOString(),
      path: 'download/app-2.0.0.exe',
      sha512: this.generateMockSha512('app-2.0.0.exe'),
      size: 50000000,
      stagingPercentage: 100,
      releaseNotes: 'New features and bug fixes',
      ...options.manifest
    }

    this.setupMiddleware()
    this.setupRoutes()
    this.setupDifferentialUpdates()
  }

  private setupMiddleware(): void {
    // Request logging
    this.app.use((req, res, next) => {
      if (this.enableLogging) {
        console.log(`[MockUpdateServer] ${req.method} ${req.path}`)
      }
      
      // Simulate network latency
      if (this.latency > 0) {
        setTimeout(next, this.latency)
      } else {
        next()
      }
    })

    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      next()
    })

    // Request tracking
    this.app.use((req, res, next) => {
      const originalSend = res.send
      res.send = function(data) {
        this.requestLogs.push({
          timestamp: new Date(),
          method: req.method,
          path: req.path,
          status: res.statusCode
        })
        return originalSend.call(this, data)
      }.bind(this)
      next()
    })
  }

  private setupRoutes(): void {
    // Latest release endpoint for Windows/Linux
    this.app.get('/latest.yml', (req, res) => {
      if (this.shouldSimulateError()) {
        return res.status(500).send('Internal Server Error')
      }
      
      const manifest = this.applyStaging(req)
      const yamlContent = this.toYaml(manifest)
      
      res.type('text/yaml').send(yamlContent)
        return
    })

    // Latest release endpoint for macOS
    this.app.get('/latest-mac.yml', (req, res) => {
      if (this.shouldSimulateError()) {
        return res.status(500).send('Internal Server Error')
      }
      
      const manifest = this.applyStaging(req)
      const macManifest = {
        ...manifest,
        path: manifest.path?.replace('.exe', '.dmg')
      }
      
      res.type('text/yaml').send(this.toYaml(macManifest))
        return
    })

    // JSON endpoint for custom implementations
    this.app.get('/latest.json', (req, res) => {
      if (this.shouldSimulateError()) {
        return res.status(500).json({ error: 'Internal Server Error' })
      }
      
      const manifest = this.applyStaging(req)
      res.json(manifest)
        return
    })

    // Download endpoint
    this.app.get('/download/:filename', (req, res) => {
      const { filename } = req.params
      
      if (this.shouldSimulateError()) {
        return res.status(503).send('Service Unavailable')
      }

      // Track download count
      const count = this.downloadCounts.get(filename) || 0
      this.downloadCounts.set(filename, count + 1)

      const filePath = join(this.fixturesPath, filename)
      
      // Create mock file if it doesn't exist
      if (!existsSync(filePath)) {
        this.createMockUpdateFile(filePath)
      }

      // Simulate partial download support
      const range = req.headers.range
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : this.updateManifest.size! - 1
        
        res.status(206)
        res.header('Content-Range', `bytes ${start}-${end}/${this.updateManifest.size}`)
        res.header('Accept-Ranges', 'bytes')
        res.header('Content-Length', String(end - start + 1))
      }

      res.download(filePath)
        return
    })

    // Differential update endpoint
    this.app.get('/differential/:fromVersion/:toVersion', (req, res) => {
      const { fromVersion, toVersion } = req.params
      const deltaKey = `${fromVersion}-${toVersion}`
      
      if (this.shouldSimulateError()) {
        return res.status(404).send('Delta not found')
      }

      const delta = this.differentialUpdates.get(deltaKey)
      if (!delta) {
        return res.status(404).json({ error: 'Differential update not available' })
      }

      const deltaPath = join(this.fixturesPath, delta.deltaPath)
      if (!existsSync(deltaPath)) {
        this.createMockDeltaFile(deltaPath, delta)
      }

      res.download(deltaPath)
        return
    })

    // Staged rollout configuration endpoint
    this.app.put('/staging/:version', express.json(), (req, res) => {
      const { version } = req.params
      const { percentage } = req.body
      
      if (version === this.updateManifest.version) {
        this.updateManifest.stagingPercentage = percentage
        res.json({ success: true, stagingPercentage: percentage })
      } else {
        res.status(404).json({ error: 'Version not found' })
      }
    })

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        downloads: Array.from(this.downloadCounts.entries()),
        requestCount: this.requestLogs.length
      })
        return
    })

    // Release notes endpoint
    this.app.get('/notes/:version', (req, res) => {
      const { version } = req.params
      
      if (version === this.updateManifest.version) {
        res.type('text/markdown').send(this.updateManifest.releaseNotes || '')
      } else {
        res.status(404).send('Release notes not found')
      }
        return
    })

    // Code signing verification endpoint (mock)
    this.app.get('/verify/:filename', (req, res) => {
      const { filename } = req.params
      
      // Simulate signature verification
      res.json({
        filename,
        valid: !this.simulateErrors,
        commonName: 'TaskMaster Inc.',
        issuer: 'DigiCert EV Code Signing CA',
        thumbprint: this.generateMockSha512(filename).substring(0, 40)
      })
        return
    })
  }

  private setupDifferentialUpdates(): void {
    // Set up mock differential updates
    this.differentialUpdates.set('1.0.0-2.0.0', {
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      deltaPath: 'deltas/1.0.0-2.0.0.delta',
      size: 5000000, // 5MB delta
      sha512: this.generateMockSha512('1.0.0-2.0.0.delta')
    })

    this.differentialUpdates.set('1.9.0-2.0.0', {
      fromVersion: '1.9.0',
      toVersion: '2.0.0',
      deltaPath: 'deltas/1.9.0-2.0.0.delta',
      size: 1000000, // 1MB delta
      sha512: this.generateMockSha512('1.9.0-2.0.0.delta')
    })
  }

  private applyStaging(req: Request): UpdateManifest {
    const stagingPercentage = this.updateManifest.stagingPercentage || 100
    
    if (stagingPercentage === 100) {
      return this.updateManifest
    }

    // Use client ID or IP for consistent staging
    const clientId = req.headers['x-client-id'] || req.ip
    const hash = createHash('md5').update(clientId).digest('hex')
    const bucket = parseInt(hash.substring(0, 8), 16) % 100

    if (bucket < stagingPercentage) {
      return this.updateManifest
    }

    // Return no update for users outside staging percentage
    return {
      version: req.headers['x-current-version'] as string || '1.0.0',
      releaseDate: new Date().toISOString()
    }
  }

  private shouldSimulateError(): boolean {
    if (!this.simulateErrors) return false
    
    // 10% error rate when error simulation is enabled
    return Math.random() < 0.1
  }

  private toYaml(obj: any): string {
    return yaml.stringify(obj)
  }

  private generateMockSha512(filename: string): string {
    return createHash('sha512').update(filename).digest('hex')
  }

  private createMockUpdateFile(filePath: string): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Create a mock binary file
    const buffer = Buffer.alloc(this.updateManifest.size || 50000000)
    buffer.write('MOCK_UPDATE_FILE', 0)
    writeFileSync(filePath, buffer)
  }

  private createMockDeltaFile(filePath: string, delta: DifferentialUpdate): void {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Create a mock delta file
    const buffer = Buffer.alloc(delta.size)
    buffer.write('MOCK_DELTA_FILE', 0)
    writeFileSync(filePath, buffer)
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (this.useHttps) {
          const httpsOptions = {
            key: readFileSync(this.getCertPath('key')),
            cert: readFileSync(this.getCertPath('cert'))
          }
          this.server = createHttpsServer(httpsOptions, this.app)
        } else {
          this.server = createHttpServer(this.app)
        }

        this.server.listen(this.port, () => {
          if (this.enableLogging) {
            console.log(`Mock update server running at ${this.baseUrl}`)
          }
          resolve(this.baseUrl)
        })

        this.server.on('error', reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (this.enableLogging) {
            console.log('Mock update server stopped')
          }
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  private getCertPath(type: 'key' | 'cert'): string {
    const filename = type === 'key' ? 'server.key' : 'server.crt'
    const defaultPath = join(this.fixturesPath, 'certs', filename)
    
    // Create self-signed certificate if it doesn't exist
    if (!existsSync(defaultPath)) {
      this.createSelfSignedCertificate()
    }
    
    return defaultPath
  }

  private createSelfSignedCertificate(): void {
    const certDir = join(this.fixturesPath, 'certs')
    if (!existsSync(certDir)) {
      mkdirSync(certDir, { recursive: true })
    }

    // Note: In a real implementation, you would use a library like 'selfsigned'
    // For testing purposes, we'll create mock certificate files
    const mockKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDZ
-----END PRIVATE KEY-----`

    const mockCert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKl
-----END CERTIFICATE-----`

    writeFileSync(join(certDir, 'server.key'), mockKey)
    writeFileSync(join(certDir, 'server.crt'), mockCert)
  }

  // Test helper methods
  public setManifest(manifest: UpdateManifest): void {
    this.updateManifest = { ...this.updateManifest, ...manifest }
  }

  public setStagingPercentage(percentage: number): void {
    this.updateManifest.stagingPercentage = percentage
  }

  public enableErrorSimulation(enable: boolean = true): void {
    this.simulateErrors = enable
  }

  public getDownloadCount(filename: string): number {
    return this.downloadCounts.get(filename) || 0
  }

  public getRequestLogs(): typeof this.requestLogs {
    return [...this.requestLogs]
  }

  public reset(): void {
    this.downloadCounts.clear()
    this.requestLogs = []
    this.simulateErrors = false
    this.updateManifest.stagingPercentage = 100
  }
}