/**
 * Security Baseline and Regression Testing Framework
 * 
 * Establishes and monitors security baselines for the Electron application
 * Tracks security metrics over time and alerts on regressions
 */

const fs = require('fs').promises;
const path = require('path');
// const crypto = require('crypto'); // Not used
const { execSync } = require('child_process');

// Import security test modules
const { SecurityAuditor } = require('./security-audit');
const { DependencyVulnerabilityScanner } = require('./dependency-vulnerability-scan');
const { CSPSecurityTester } = require('./csp-security-test');

// Baseline configuration
const BASELINE_CONFIG = {
  baselineFile: path.join(__dirname, '../.taskmaster/security/security-baseline.json'),
  historyFile: path.join(__dirname, '../.taskmaster/security/security-history.json'),
  reportDir: path.join(__dirname, '../test-results/security'),
  
  // Regression thresholds
  thresholds: {
    scoreRegression: 5,          // Alert if score drops by 5+ points
    newCriticalViolations: 0,    // Alert on any new critical violations
    newHighViolations: 2,        // Alert if 2+ new high violations
    dependencyIncrease: 10,      // Alert if vulnerable dependencies increase by 10+
    cspScoreRegression: 10       // Alert if CSP score drops by 10+ points
  },
  
  // Metrics to track
  metrics: [
    'electronegativity_score',
    'dependency_vulnerabilities',
    'csp_score',
    'security_headers',
    'permission_handling',
    'ipc_security',
    'total_violations'
  ]
};

class SecurityBaselineManager {
  constructor() {
    this.currentResults = {};
    this.baseline = null;
    this.history = [];
  }

  async run(options = {}) {
    console.log('🔒 Security Baseline and Regression Testing\n');
    
    try {
      // Load existing baseline and history
      await this.loadBaseline();
      await this.loadHistory();
      
      // Run all security tests
      console.log('📊 Running security test suite...\n');
      await this.runSecurityTests();
      
      // Compare with baseline
      const comparison = await this.compareWithBaseline();
      
      // Check for regressions
      const regressions = this.checkForRegressions(comparison);
      
      // Update history
      await this.updateHistory();
      
      // Generate reports
      await this.generateReports(comparison, regressions);
      
      // Update baseline if requested
      if (options.updateBaseline) {
        await this.updateBaseline();
        console.log('\n✅ Security baseline updated');
      }
      
      // Print summary
      this.printSummary(comparison, regressions);
      
      return {
        passed: regressions.length === 0,
        comparison,
        regressions
      };
    } catch (error) {
      console.error('❌ Security baseline testing failed:', error.message);
      return { passed: false, error: error.message };
    }
  }

  async loadBaseline() {
    try {
      const baselineData = await fs.readFile(BASELINE_CONFIG.baselineFile, 'utf8');
      this.baseline = JSON.parse(baselineData);
      console.log('📋 Loaded security baseline from', new Date(this.baseline.timestamp).toLocaleDateString());
    } catch {
      console.log('ℹ️  No existing baseline found, will create new one');
      this.baseline = null;
    }
  }

  async loadHistory() {
    try {
      const historyData = await fs.readFile(BASELINE_CONFIG.historyFile, 'utf8');
      this.history = JSON.parse(historyData);
    } catch {
      this.history = [];
    }
  }

  async runSecurityTests() {
    // Run tests in parallel for efficiency
    const [electronegativity, dependencies, csp, electronTests] = await Promise.all([
      this.runElectronegativity(),
      this.runDependencyScans(),
      this.runCSPTests(),
      this.runElectronSecurityTests()
    ]);

    // Aggregate results
    this.currentResults = {
      timestamp: new Date().toISOString(),
      commit: this.getGitCommit(),
      branch: this.getGitBranch(),
      
      electronegativity: electronegativity,
      dependencies: dependencies,
      csp: csp,
      electronTests: electronTests,
      
      // Calculate aggregate metrics
      metrics: this.calculateMetrics({
        electronegativity,
        dependencies,
        csp,
        electronTests
      })
    };
  }

  async runElectronegativity() {
    console.log('🔍 Running Electronegativity...');
    
    try {
      const auditor = new SecurityAuditor();
      // Mock the run method to return results instead of exiting
      const originalExit = process.exit;
      process.exit = () => {};
      
      await auditor.run();
      
      process.exit = originalExit;
      
      return {
        passed: auditor.results.passed,
        summary: auditor.results.summary,
        score: 100 - (auditor.results.summary.critical * 20 + auditor.results.summary.high * 10)
      };
    } catch (error) {
      console.error('Electronegativity failed:', error.message);
      return { passed: false, error: error.message, score: 0 };
    }
  }

  async runDependencyScans() {
    console.log('📦 Running dependency vulnerability scans...');
    
    try {
      const scanner = new DependencyVulnerabilityScanner();
      const originalExit = process.exit;
      process.exit = () => {};
      
      await scanner.run();
      
      process.exit = originalExit;
      
      return {
        passed: scanner.results.summary.critical === 0,
        summary: scanner.results.summary,
        totalVulnerabilities: scanner.results.summary.total
      };
    } catch (error) {
      console.error('Dependency scan failed:', error.message);
      return { passed: false, error: error.message, totalVulnerabilities: -1 };
    }
  }

  async runCSPTests() {
    console.log('🛡️ Running CSP security tests...');
    
    try {
      const tester = new CSPSecurityTester();
      const passed = await tester.run();
      
      return {
        passed: passed,
        score: tester.results.score,
        compliance: tester.results.compliance,
        violations: tester.results.violations.length
      };
    } catch (error) {
      console.error('CSP tests failed:', error.message);
      return { passed: false, error: error.message, score: 0 };
    }
  }

  async runElectronSecurityTests() {
    console.log('⚡ Running Electron-specific security tests...');
    
    try {
      // Run Playwright Electron security tests
      const { stdout } = execSync('npm run test -- tests/e2e/electron-security.test.ts', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse test results
      // const passed = stdout.includes('passed'); // Not used
      const failedTests = (stdout.match(/failed/g) || []).length;
      
      return {
        passed: failedTests === 0,
        totalTests: 20, // Approximate from the test file
        failedTests: failedTests
      };
    } catch (error) {
      // Test command failed
      return {
        passed: false,
        error: error.message,
        totalTests: 20,
        failedTests: 20
      };
    }
  }

  calculateMetrics(results) {
    return {
      electronegativity_score: results.electronegativity.score || 0,
      dependency_vulnerabilities: results.dependencies.totalVulnerabilities || 0,
      csp_score: results.csp.score || 0,
      security_headers: results.csp.compliance?.electronSecurity ? 100 : 0,
      permission_handling: results.electronTests.passed ? 100 : 0,
      ipc_security: results.electronegativity.passed ? 100 : 0,
      total_violations: (
        (results.electronegativity.summary?.total || 0) +
        (results.csp.violations || 0) +
        (results.electronTests.failedTests || 0)
      ),
      overall_score: this.calculateOverallScore(results)
    };
  }

  calculateOverallScore(results) {
    const weights = {
      electronegativity: 0.3,
      dependencies: 0.25,
      csp: 0.25,
      electronTests: 0.2
    };
    
    const scores = {
      electronegativity: results.electronegativity.score || 0,
      dependencies: results.dependencies.passed ? 100 : 50,
      csp: results.csp.score || 0,
      electronTests: results.electronTests.passed ? 100 : 50
    };
    
    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key] * weight);
    }, 0);
  }

  async compareWithBaseline() {
    if (!this.baseline) {
      return {
        isNewBaseline: true,
        changes: {},
        improvements: [],
        regressions: []
      };
    }

    const comparison = {
      isNewBaseline: false,
      changes: {},
      improvements: [],
      regressions: []
    };

    // Compare each metric
    BASELINE_CONFIG.metrics.forEach(metric => {
      const baselineValue = this.baseline.metrics[metric];
      const currentValue = this.currentResults.metrics[metric];
      
      if (baselineValue !== currentValue) {
        const change = currentValue - baselineValue;
        comparison.changes[metric] = {
          baseline: baselineValue,
          current: currentValue,
          change: change,
          percentChange: baselineValue > 0 ? (change / baselineValue) * 100 : 0
        };
        
        // Classify as improvement or regression
        if (metric.includes('score')) {
          // Higher scores are better
          if (change > 0) {
            comparison.improvements.push({ metric, change });
          } else if (change < 0) {
            comparison.regressions.push({ metric, change });
          }
        } else if (metric.includes('vulnerabilities') || metric.includes('violations')) {
          // Lower is better for vulnerabilities/violations
          if (change < 0) {
            comparison.improvements.push({ metric, change });
          } else if (change > 0) {
            comparison.regressions.push({ metric, change });
          }
        }
      }
    });

    return comparison;
  }

  checkForRegressions(comparison) {
    const regressions = [];
    
    if (comparison.isNewBaseline) {
      return regressions;
    }

    // Check score regressions
    Object.entries(comparison.changes).forEach(([metric, change]) => {
      if (metric.includes('score') && Math.abs(change.change) >= BASELINE_CONFIG.thresholds.scoreRegression) {
        regressions.push({
          type: 'score_regression',
          metric,
          severity: 'high',
          message: `${metric} dropped by ${Math.abs(change.change).toFixed(1)} points`,
          baseline: change.baseline,
          current: change.current
        });
      }
    });

    // Check for new critical violations
    const currentCritical = this.currentResults.electronegativity?.summary?.critical || 0;
    const baselineCritical = this.baseline?.electronegativity?.summary?.critical || 0;
    
    if (currentCritical > baselineCritical + BASELINE_CONFIG.thresholds.newCriticalViolations) {
      regressions.push({
        type: 'new_critical_violations',
        severity: 'critical',
        message: `${currentCritical - baselineCritical} new critical security violations detected`,
        baseline: baselineCritical,
        current: currentCritical
      });
    }

    // Check dependency vulnerabilities increase
    const vulnChange = comparison.changes.dependency_vulnerabilities;
    if (vulnChange && vulnChange.change >= BASELINE_CONFIG.thresholds.dependencyIncrease) {
      regressions.push({
        type: 'dependency_regression',
        severity: 'high',
        message: `Vulnerable dependencies increased by ${vulnChange.change}`,
        baseline: vulnChange.baseline,
        current: vulnChange.current
      });
    }

    // Check CSP score regression
    const cspChange = comparison.changes.csp_score;
    if (cspChange && Math.abs(cspChange.change) >= BASELINE_CONFIG.thresholds.cspScoreRegression) {
      regressions.push({
        type: 'csp_regression',
        severity: 'high',
        message: `CSP security score dropped by ${Math.abs(cspChange.change).toFixed(1)} points`,
        baseline: cspChange.baseline,
        current: cspChange.current
      });
    }

    return regressions;
  }

  async updateHistory() {
    // Add current results to history
    this.history.push({
      timestamp: this.currentResults.timestamp,
      commit: this.currentResults.commit,
      branch: this.currentResults.branch,
      metrics: this.currentResults.metrics,
      summary: {
        overallScore: this.currentResults.metrics.overall_score,
        passed: this.currentResults.electronegativity.passed && 
                this.currentResults.dependencies.passed && 
                this.currentResults.csp.passed && 
                this.currentResults.electronTests.passed
      }
    });

    // Keep last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    // Save history
    await this.ensureDirectoryExists(path.dirname(BASELINE_CONFIG.historyFile));
    await fs.writeFile(BASELINE_CONFIG.historyFile, JSON.stringify(this.history, null, 2));
  }

  async updateBaseline() {
    this.baseline = JSON.parse(JSON.stringify(this.currentResults));
    
    await this.ensureDirectoryExists(path.dirname(BASELINE_CONFIG.baselineFile));
    await fs.writeFile(BASELINE_CONFIG.baselineFile, JSON.stringify(this.baseline, null, 2));
  }

  async generateReports(comparison, regressions) {
    await this.ensureDirectoryExists(BASELINE_CONFIG.reportDir);
    
    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      baseline: this.baseline,
      current: this.currentResults,
      comparison,
      regressions,
      passed: regressions.length === 0
    };
    
    const jsonPath = path.join(BASELINE_CONFIG.reportDir, 'security-baseline-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    // Generate HTML report
    const htmlPath = path.join(BASELINE_CONFIG.reportDir, 'security-baseline-report.html');
    await fs.writeFile(htmlPath, this.generateHTMLReport(comparison, regressions));
    
    // Generate trend chart data
    const trendPath = path.join(BASELINE_CONFIG.reportDir, 'security-trends.json');
    await fs.writeFile(trendPath, JSON.stringify(this.generateTrendData(), null, 2));
    
    console.log('\n📄 Reports generated:');
    console.log(`   - Baseline Report: ${jsonPath}`);
    console.log(`   - HTML Report: ${htmlPath}`);
    console.log(`   - Trend Data: ${trendPath}`);
  }

  generateHTMLReport(comparison, regressions) {
    const current = this.currentResults;
    const baseline = this.baseline;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Security Baseline Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #1a1a1a; color: white; padding: 20px; border-radius: 8px; }
    .status { font-size: 24px; padding: 10px 20px; border-radius: 4px; display: inline-block; }
    .passed { background: #10b981; color: white; }
    .failed { background: #ef4444; color: white; }
    .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .metric:last-child { border-bottom: none; }
    .improvement { color: #10b981; }
    .regression { color: #ef4444; }
    .neutral { color: #6b7280; }
    .chart { width: 100%; height: 300px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9fafb; font-weight: bold; }
    .regression-item { background: #fef2f2; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #ef4444; }
    .critical { border-left-color: #dc2626; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="header">
    <h1>Security Baseline Report</h1>
    <div class="status ${regressions.length === 0 ? 'passed' : 'failed'}">
      ${regressions.length === 0 ? '✅ PASSED' : '❌ FAILED'}
    </div>
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>Commit: ${current.commit || 'N/A'} | Branch: ${current.branch || 'N/A'}</p>
  </div>

  ${regressions.length > 0 ? `
    <div class="section">
      <h2>⚠️ Security Regressions Detected</h2>
      ${regressions.map(r => `
        <div class="regression-item ${r.severity}">
          <strong>${r.type.replace(/_/g, ' ').toUpperCase()}</strong>
          <p>${r.message}</p>
          <p>Baseline: ${r.baseline} → Current: ${r.current}</p>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <div class="section">
    <h2>Security Metrics Comparison</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Baseline</th>
        <th>Current</th>
        <th>Change</th>
      </tr>
      ${BASELINE_CONFIG.metrics.map(metric => {
        const change = comparison.changes[metric];
        const baselineValue = baseline?.metrics?.[metric] ?? 'N/A';
        const currentValue = current.metrics[metric];
        const changeValue = change ? change.change : 0;
        const changeClass = changeValue > 0 ? 
          (metric.includes('score') ? 'improvement' : 'regression') :
          (changeValue < 0 ? 
            (metric.includes('score') ? 'regression' : 'improvement') : 
            'neutral');
        
        return `
          <tr>
            <td>${metric.replace(/_/g, ' ')}</td>
            <td>${baselineValue}</td>
            <td>${currentValue}</td>
            <td class="${changeClass}">
              ${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}
              ${change ? ` (${change.percentChange.toFixed(1)}%)` : ''}
            </td>
          </tr>
        `;
      }).join('')}
    </table>
  </div>

  <div class="section">
    <h2>Test Results Summary</h2>
    <div class="metric">
      <span>Electronegativity</span>
      <span class="${current.electronegativity.passed ? 'improvement' : 'regression'}">
        ${current.electronegativity.passed ? '✅ Passed' : '❌ Failed'}
        (Score: ${current.electronegativity.score || 0})
      </span>
    </div>
    <div class="metric">
      <span>Dependency Vulnerabilities</span>
      <span class="${current.dependencies.passed ? 'improvement' : 'regression'}">
        ${current.dependencies.totalVulnerabilities} vulnerabilities found
      </span>
    </div>
    <div class="metric">
      <span>Content Security Policy</span>
      <span class="${current.csp.passed ? 'improvement' : 'regression'}">
        ${current.csp.passed ? '✅ Passed' : '❌ Failed'}
        (Score: ${current.csp.score || 0})
      </span>
    </div>
    <div class="metric">
      <span>Electron Security Tests</span>
      <span class="${current.electronTests.passed ? 'improvement' : 'regression'}">
        ${current.electronTests.passed ? '✅ All tests passed' : `❌ ${current.electronTests.failedTests} tests failed`}
      </span>
    </div>
  </div>

  <div class="section">
    <h2>Security Score Trend</h2>
    <canvas id="trendChart" class="chart"></canvas>
  </div>

  <script>
    // Render trend chart
    const trendData = ${JSON.stringify(this.generateTrendData())};
    const ctx = document.getElementById('trendChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: trendData.labels,
        datasets: [{
          label: 'Overall Security Score',
          data: trendData.overallScore,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.1
        }, {
          label: 'Electronegativity Score',
          data: trendData.electronegativityScore,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.1
        }, {
          label: 'CSP Score',
          data: trendData.cspScore,
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  </script>
</body>
</html>
    `;
  }

  generateTrendData() {
    const recentHistory = this.history.slice(-20); // Last 20 data points
    
    return {
      labels: recentHistory.map(h => new Date(h.timestamp).toLocaleDateString()),
      overallScore: recentHistory.map(h => h.metrics.overall_score || 0),
      electronegativityScore: recentHistory.map(h => h.metrics.electronegativity_score || 0),
      cspScore: recentHistory.map(h => h.metrics.csp_score || 0),
      vulnerabilities: recentHistory.map(h => h.metrics.dependency_vulnerabilities || 0)
    };
  }

  printSummary(comparison, regressions) {
    console.log('\n📊 Security Baseline Summary:');
    console.log('━'.repeat(50));
    
    if (comparison.isNewBaseline) {
      console.log('   📋 New baseline established');
    } else {
      console.log(`   📈 Improvements: ${comparison.improvements.length}`);
      console.log(`   📉 Regressions: ${comparison.regressions.length}`);
    }
    
    console.log(`   🔒 Overall Security Score: ${this.currentResults.metrics.overall_score.toFixed(1)}/100`);
    console.log(`   ⚠️  Security Regressions: ${regressions.length}`);
    console.log('━'.repeat(50));
    
    if (regressions.length > 0) {
      console.log('\n❌ Security regressions detected:');
      regressions.forEach(r => {
        console.log(`   - ${r.message}`);
      });
    } else if (!comparison.isNewBaseline) {
      console.log('\n✅ No security regressions detected');
    }
  }

  // Utility methods
  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  async ensureDirectoryExists(dir) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Main execution
async function main() {
  const manager = new SecurityBaselineManager();
  const options = {
    updateBaseline: process.argv.includes('--update-baseline')
  };
  
  const results = await manager.run(options);
  
  if (!results.passed) {
    console.log('\n❌ Security baseline check failed!');
    process.exit(1);
  } else {
    console.log('\n✅ Security baseline check passed!');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { SecurityBaselineManager, BASELINE_CONFIG };