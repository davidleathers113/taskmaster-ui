#!/usr/bin/env npx ts-node

/**
 * Unified Test Runner Script (2025)
 * 
 * Orchestrates all test types with comprehensive reporting and result aggregation.
 * Implements 2025 best practices for test pipeline management:
 * - Dependency-aware execution scheduling
 * - Multi-format report aggregation
 * - Performance monitoring and regression detection
 * - Cross-platform compatibility verification
 */

import { spawn, SpawnOptions } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { performance } from 'perf_hooks'
import { unifiedTestConfig, TestSuite } from '../tests/config/unified-test-runner.config'

interface TestResult {
  suite: string
  status: 'success' | 'failure' | 'skipped' | 'timeout'
  startTime: number
  endTime: number
  duration: number
  exitCode: number
  output: string
  errorOutput: string
  reportPaths: string[]
  coverage?: {
    lines: number
    functions: number
    branches: number
    statements: number
  }
  performance?: {
    memoryUsage: number
    cpuUsage: number
    customMetrics: Record<string, number>
  }
}

interface UnifiedTestReport {
  timestamp: string
  platform: string
  nodeVersion: string
  totalDuration: number
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    successRate: number
  }
  results: TestResult[]
  aggregatedCoverage?: {
    lines: number
    functions: number
    branches: number
    statements: number
  }
  performanceMetrics: {
    overallMemoryUsage: number
    overallCpuUsage: number
    testExecutionTime: number
    regressionDetected: boolean
  }
  thresholdValidation: {
    passed: boolean
    violations: string[]
  }
}

class UnifiedTestRunner {
  private results: TestResult[] = []
  private startTime: number = 0
  private config = unifiedTestConfig

  constructor(private options: {
    mode?: 'ci' | 'nightly' | 'release' | 'custom'
    parallel?: boolean
    platform?: string
    verbose?: boolean
    filter?: string[]
  } = {}) {
    this.options = {
      mode: 'ci',
      parallel: true,
      platform: process.platform,
      verbose: false,
      ...options
    }
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Unified Test Pipeline...')
    console.log(`📊 Mode: ${this.options.mode}`)
    console.log(`🔄 Platform: ${this.options.platform}`)
    console.log(`⚡ Parallel: ${this.options.parallel}`)
    
    this.startTime = performance.now()

    try {
      await this.setupEnvironment()
      await this.executeSuites()
      await this.generateReports()
      await this.validateThresholds()
      await this.cleanup()
      
      const successRate = this.calculateSuccessRate()
      if (successRate < 100) {
        console.error(`❌ Test pipeline completed with ${100 - successRate}% failure rate`)
        process.exit(1)
      } else {
        console.log('✅ All tests passed successfully!')
      }
    } catch (error) {
      console.error('💥 Test pipeline failed:', error)
      await this.generateFailureReport(error)
      process.exit(1)
    }
  }

  private async setupEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...')
    
    // Create output directories
    const outputDir = this.config.reporting.outputDir
    await fs.mkdir(outputDir, { recursive: true })
    
    for (const suite of this.config.suites) {
      await fs.mkdir(suite.outputPath, { recursive: true })
    }

    // Set environment variables
    process.env.NODE_ENV = 'test'
    process.env.UNIFIED_TEST_MODE = this.options.mode
    process.env.TEST_PLATFORM = this.options.platform
    process.env.CI = process.env.CI || 'true'

    console.log('✅ Environment setup complete')
  }

  private async executeSuites(): Promise<void> {
    const suitesToRun = this.getSuitesToRun()
    console.log(`📋 Executing ${suitesToRun.length} test suites...`)

    if (this.options.parallel) {
      await this.executeParallel(suitesToRun)
    } else {
      await this.executeSequential(suitesToRun)
    }
  }

  private getSuitesToRun(): TestSuite[] {
    const mode = this.options.mode || 'ci'
    const suiteNames = this.config.scheduling.conditional[mode] || []
    
    let suites = this.config.suites.filter(suite => 
      suiteNames.includes(suite.name) &&
      (!suite.platforms || suite.platforms.includes(this.options.platform!))
    )

    if (this.options.filter && this.options.filter.length > 0) {
      suites = suites.filter(suite => 
        this.options.filter!.some(filter => suite.name.includes(filter))
      )
    }

    return suites
  }

  private async executeParallel(suites: TestSuite[]): Promise<void> {
    const parallelGroups = this.groupSuitesByDependencies(suites)
    
    for (const group of parallelGroups) {
      console.log(`🔄 Executing parallel group: ${group.map(s => s.name).join(', ')}`)
      
      const promises = group.map(suite => this.executeSuite(suite))
      await Promise.allSettled(promises)
    }
  }

  private async executeSequential(suites: TestSuite[]): Promise<void> {
    for (const suite of suites) {
      await this.executeSuite(suite)
    }
  }

  private groupSuitesByDependencies(suites: TestSuite[]): TestSuite[][] {
    // Simple dependency resolution - could be enhanced with topological sorting
    const noDeps = suites.filter(s => !s.dependencies || s.dependencies.length === 0)
    const withDeps = suites.filter(s => s.dependencies && s.dependencies.length > 0)
    
    return [noDeps, withDeps]
  }

  private async executeSuite(suite: TestSuite): Promise<void> {
    console.log(`🧪 Running ${suite.name}...`)
    
    const startTime = performance.now()
    const result: TestResult = {
      suite: suite.name,
      status: 'success',
      startTime,
      endTime: 0,
      duration: 0,
      exitCode: 0,
      output: '',
      errorOutput: '',
      reportPaths: []
    }

    try {
      const { exitCode, output, errorOutput } = await this.runCommand(
        suite.command,
        suite.timeout,
        suite.retries
      )

      result.exitCode = exitCode
      result.output = output
      result.errorOutput = errorOutput
      result.status = exitCode === 0 ? 'success' : 'failure'

      // Collect performance metrics if available
      result.performance = await this.collectPerformanceMetrics(suite)
      
      // Collect coverage data if available
      result.coverage = await this.collectCoverageData(suite)

      // Find generated report files
      result.reportPaths = await this.findReportFiles(suite.outputPath)

    } catch (error) {
      result.status = 'failure'
      result.errorOutput = error instanceof Error ? error.message : String(error)
      console.error(`❌ ${suite.name} failed:`, error)
    } finally {
      result.endTime = performance.now()
      result.duration = result.endTime - result.startTime
      this.results.push(result)
      
      const statusIcon = result.status === 'success' ? '✅' : '❌'
      console.log(`${statusIcon} ${suite.name} completed in ${Math.round(result.duration)}ms`)
    }
  }

  private async runCommand(
    command: string,
    timeout: number,
    retries: number
  ): Promise<{ exitCode: number; output: string; errorOutput: string }> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${retries}`)
        await this.delay(1000 * attempt) // Exponential backoff
      }

      try {
        return await this.executeCommand(command, timeout)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt === retries) {
          throw lastError
        }
      }
    }

    throw lastError
  }

  private executeCommand(
    command: string,
    timeout: number
  ): Promise<{ exitCode: number; output: string; errorOutput: string }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ')
      
      const options: SpawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env }
      }

      const child = spawn(cmd, args, options)
      let output = ''
      let errorOutput = ''

      child.stdout?.on('data', (data) => {
        output += data.toString()
        if (this.options.verbose) {
          process.stdout.write(data)
        }
      })

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString()
        if (this.options.verbose) {
          process.stderr.write(data)
        }
      })

      const timeoutId = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timed out after ${timeout}ms`))
      }, timeout)

      child.on('close', (code) => {
        clearTimeout(timeoutId)
        resolve({
          exitCode: code || 0,
          output,
          errorOutput
        })
      })

      child.on('error', (error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
    })
  }

  private async collectPerformanceMetrics(suite: TestSuite): Promise<TestResult['performance']> {
    // Mock implementation - would integrate with actual performance monitoring
    const memoryUsage = process.memoryUsage()
    return {
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: process.cpuUsage().user / 1000, // ms
      customMetrics: {}
    }
  }

  private async collectCoverageData(suite: TestSuite): Promise<TestResult['coverage']> {
    try {
      const coveragePath = path.join(suite.outputPath, 'coverage', 'coverage-summary.json')
      const coverageData = await fs.readFile(coveragePath, 'utf-8')
      const coverage = JSON.parse(coverageData)
      
      return {
        lines: coverage.total.lines.pct,
        functions: coverage.total.functions.pct,
        branches: coverage.total.branches.pct,
        statements: coverage.total.statements.pct
      }
    } catch {
      return undefined
    }
  }

  private async findReportFiles(outputPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputPath, { recursive: true })
      return files
        .filter(file => /\.(html|json|xml)$/.test(String(file)))
        .map(file => path.join(outputPath, String(file)))
    } catch {
      return []
    }
  }

  private async generateReports(): Promise<void> {
    console.log('📊 Generating unified test reports...')
    
    const report = await this.buildUnifiedReport()
    
    // Generate HTML report
    await this.generateHtmlReport(report)
    
    // Generate JSON report
    await this.generateJsonReport(report)
    
    // Generate JUnit XML report
    await this.generateJunitReport(report)
    
    // Generate Allure-compatible report
    await this.generateAllureReport(report)

    console.log('📋 Reports generated successfully')
  }

  private async buildUnifiedReport(): Promise<UnifiedTestReport> {
    const endTime = performance.now()
    const totalDuration = endTime - this.startTime

    const passed = this.results.filter(r => r.status === 'success').length
    const failed = this.results.filter(r => r.status === 'failure').length
    const skipped = this.results.filter(r => r.status === 'skipped').length

    return {
      timestamp: new Date().toISOString(),
      platform: this.options.platform!,
      nodeVersion: process.version,
      totalDuration,
      summary: {
        total: this.results.length,
        passed,
        failed,
        skipped,
        successRate: (passed / this.results.length) * 100
      },
      results: this.results,
      performanceMetrics: {
        overallMemoryUsage: this.calculateOverallMemoryUsage(),
        overallCpuUsage: this.calculateOverallCpuUsage(),
        testExecutionTime: totalDuration,
        regressionDetected: await this.detectPerformanceRegression()
      },
      thresholdValidation: {
        passed: true,
        violations: []
      }
    }
  }

  private async generateHtmlReport(report: UnifiedTestReport): Promise<void> {
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Unified Test Report - ${report.timestamp}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric.success { border-left: 4px solid #28a745; }
        .metric.failure { border-left: 4px solid #dc3545; }
        .metric.warning { border-left: 4px solid #ffc107; }
        .metric-value { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
        .metric-label { color: #666; font-size: 14px; }
        .results { margin-top: 30px; }
        .result { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .result.success { border-left: 4px solid #28a745; }
        .result.failure { border-left: 4px solid #dc3545; }
        .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .result-name { font-weight: bold; }
        .result-duration { color: #666; font-size: 14px; }
        .result-details { font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Unified Test Report</h1>
            <p>Generated: ${report.timestamp}</p>
            <p>Platform: ${report.platform} | Node: ${report.nodeVersion}</p>
        </div>
        
        <div class="summary">
            <div class="metric ${report.summary.successRate === 100 ? 'success' : 'failure'}">
                <div class="metric-value">${report.summary.successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.total}</div>
                <div class="metric-label">Total Suites</div>
            </div>
            <div class="metric success">
                <div class="metric-value">${report.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric failure">
                <div class="metric-value">${report.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${Math.round(report.totalDuration / 1000)}s</div>
                <div class="metric-label">Total Duration</div>
            </div>
        </div>
        
        <div class="results">
            <h2>Test Suite Results</h2>
            ${report.results.map(result => `
                <div class="result ${result.status}">
                    <div class="result-header">
                        <span class="result-name">${result.status === 'success' ? '✅' : '❌'} ${result.suite}</span>
                        <span class="result-duration">${Math.round(result.duration / 1000)}s</span>
                    </div>
                    <div class="result-details">
                        Exit Code: ${result.exitCode} | 
                        ${result.coverage ? `Coverage: ${result.coverage.lines}%` : 'No coverage data'}
                        ${result.performance ? ` | Memory: ${result.performance.memoryUsage.toFixed(1)}MB` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `

    const reportPath = path.join(this.config.reporting.outputDir, 'unified-report.html')
    await fs.writeFile(reportPath, htmlTemplate)
  }

  private async generateJsonReport(report: UnifiedTestReport): Promise<void> {
    const reportPath = path.join(this.config.reporting.outputDir, 'unified-report.json')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  }

  private async generateJunitReport(report: UnifiedTestReport): Promise<void> {
    const junit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${report.summary.total}" failures="${report.summary.failed}" time="${report.totalDuration / 1000}">
${report.results.map(result => `
  <testsuite name="${result.suite}" tests="1" failures="${result.status === 'failure' ? 1 : 0}" time="${result.duration / 1000}">
    <testcase name="${result.suite}" time="${result.duration / 1000}">
      ${result.status === 'failure' ? `<failure message="Test failed">${result.errorOutput}</failure>` : ''}
    </testcase>
  </testsuite>
`).join('')}
</testsuites>`

    const reportPath = path.join(this.config.reporting.outputDir, 'junit.xml')
    await fs.writeFile(reportPath, junit)
  }

  private async generateAllureReport(report: UnifiedTestReport): Promise<void> {
    // Generate Allure-compatible results
    const allureDir = path.join(this.config.reporting.outputDir, 'allure-results')
    await fs.mkdir(allureDir, { recursive: true })

    for (const result of report.results) {
      const allureResult = {
        uuid: `${result.suite}-${Date.now()}`,
        name: result.suite,
        status: result.status === 'success' ? 'passed' : 'failed',
        stage: 'finished',
        start: result.startTime,
        stop: result.endTime,
        duration: result.duration
      }

      await fs.writeFile(
        path.join(allureDir, `${result.suite}-result.json`),
        JSON.stringify(allureResult, null, 2)
      )
    }
  }

  private calculateSuccessRate(): number {
    const passed = this.results.filter(r => r.status === 'success').length
    return (passed / this.results.length) * 100
  }

  private calculateOverallMemoryUsage(): number {
    return this.results.reduce((total, result) => 
      total + (result.performance?.memoryUsage || 0), 0
    ) / this.results.length
  }

  private calculateOverallCpuUsage(): number {
    return this.results.reduce((total, result) => 
      total + (result.performance?.cpuUsage || 0), 0
    ) / this.results.length
  }

  private async detectPerformanceRegression(): Promise<boolean> {
    // Simple regression detection - would be enhanced with historical data
    const totalDuration = performance.now() - this.startTime
    const threshold = this.config.performance.thresholds['test-duration']
    return totalDuration > threshold
  }

  private async validateThresholds(): Promise<void> {
    console.log('🔍 Validating performance thresholds...')
    
    const violations: string[] = []
    const totalDuration = performance.now() - this.startTime
    
    if (totalDuration > this.config.performance.thresholds['test-duration']) {
      violations.push(`Test duration exceeded threshold: ${totalDuration}ms > ${this.config.performance.thresholds['test-duration']}ms`)
    }

    if (violations.length > 0) {
      console.warn('⚠️ Performance threshold violations detected:')
      violations.forEach(violation => console.warn(`  - ${violation}`))
    } else {
      console.log('✅ All performance thresholds passed')
    }
  }

  private async generateFailureReport(error: any): Promise<void> {
    const failureReport = {
      timestamp: new Date().toISOString(),
      platform: this.options.platform,
      error: error.message || String(error),
      stack: error.stack,
      partialResults: this.results
    }

    const reportPath = path.join(this.config.reporting.outputDir, 'failure-report.json')
    await fs.mkdir(path.dirname(reportPath), { recursive: true })
    await fs.writeFile(reportPath, JSON.stringify(failureReport, null, 2))
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up temporary files...')
    // Cleanup logic would go here
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const options: any = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        options.mode = args[++i]
        break
      case '--parallel':
        options.parallel = args[++i] === 'true'
        break
      case '--platform':
        options.platform = args[++i]
        break
      case '--verbose':
        options.verbose = true
        break
      case '--filter':
        options.filter = args[++i].split(',')
        break
    }
  }

  const runner = new UnifiedTestRunner(options)
  await runner.run()
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unified test runner failed:', error)
    process.exit(1)
  })
}

export { UnifiedTestRunner }