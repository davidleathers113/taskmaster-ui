/**
 * Security Audit Script for Electron Application
 * Using Electronegativity to detect security misconfigurations
 * 
 * Following 2025 best practices:
 * - Automated security scanning in CI/CD
 * - Severity-based failure thresholds
 * - Detailed reporting with remediation suggestions
 * - Integration with development workflow
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, '../test-results/security'),
  outputFile: 'electronegativity-results.json',
  htmlReport: 'security-audit-report.html',
  severityThresholds: {
    critical: 0,  // Fail on any critical issues
    high: 0,      // Fail on any high severity issues
    medium: 5,    // Allow up to 5 medium severity issues
    low: -1       // No limit on low severity issues
  },
  excludeChecks: [
    // Add any checks to exclude here if needed
    // 'CHECK_NAME_HERE'
  ]
};

// Common Electron security issues to highlight
// const SECURITY_PATTERNS = { // Not used currently
//   contextIsolation: {
//     severity: 'critical',
//     description: 'Context isolation must be enabled to prevent renderer process access to Node.js'
//   },
//   nodeIntegration: {
//     severity: 'critical',
//     description: 'Node integration should be disabled in renderer processes'
//   },
//   webSecurity: {
//     severity: 'high',
//     description: 'Web security should not be disabled'
//   },
//   allowRunningInsecureContent: {
//     severity: 'high',
//     description: 'Running insecure content should not be allowed'
//   },
//   experimentalFeatures: {
//     severity: 'medium',
//     description: 'Experimental features should be disabled in production'
//   },
//   remoteModule: {
//     severity: 'high',
//     description: 'Remote module is deprecated and should not be used'
//   }
// };

class SecurityAuditor {
  constructor() {
    this.results = null;
    this.startTime = Date.now();
  }

  async run() {
    console.log('🔒 Starting Electron Security Audit with Electronegativity...\n');
    
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();
      
      // Run Electronegativity
      const scanResults = await this.runElectronegativity();
      
      // Parse and analyze results
      this.results = await this.parseResults(scanResults);
      
      // Generate reports
      await this.generateReports();
      
      // Check against thresholds
      const passed = this.checkThresholds();
      
      // Print summary
      this.printSummary();
      
      return passed;
    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      process.exit(1);
    }
  }

  async ensureOutputDirectory() {
    if (!existsSync(CONFIG.outputDir)) {
      await fs.mkdir(CONFIG.outputDir, { recursive: true });
    }
  }

  async runElectronegativity() {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
      
      // Build Electronegativity command
      const args = [
        'electronegativity',
        '-i', '.',  // Input directory (project root)
        '-o', outputPath,
        '-f', 'json',
        '-r', 'relative'  // Use relative paths in output
      ];
      
      // Add exclude checks if any
      if (CONFIG.excludeChecks.length > 0) {
        args.push('-x', CONFIG.excludeChecks.join(','));
      }
      
      console.log('Running:', 'npx', args.join(' '));
      
      const electronegativity = spawn('npx', args, {
        stdio: 'pipe',
        shell: true
      });
      
      let stdout = '';
      let stderr = '';
      
      electronegativity.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      
      electronegativity.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      electronegativity.on('close', async (code) => {
        if (code === 0 || existsSync(outputPath)) {
          // Even if exit code is non-zero, check if results were generated
          try {
            const results = await fs.readFile(outputPath, 'utf8');
            resolve(JSON.parse(results));
          } catch (error) {
            // If no results file, use stdout
            try {
              resolve(JSON.parse(stdout));
            } catch {
              reject(new Error(`Failed to parse results: ${error.message}`));
            }
          }
        } else {
          reject(new Error(`Electronegativity exited with code ${code}\n${stderr}`));
        }
      });
    });
  }

  async parseResults(rawResults) {
    // Group results by severity
    const grouped = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };
    
    // Ensure rawResults is an array
    const results = Array.isArray(rawResults) ? rawResults : [];
    
    results.forEach(issue => {
      const severity = (issue.severity || 'info').toLowerCase();
      if (grouped[severity]) {
        grouped[severity].push(issue);
      } else {
        grouped.info.push(issue);
      }
    });
    
    return {
      raw: results,
      grouped,
      summary: {
        total: results.length,
        critical: grouped.critical.length,
        high: grouped.high.length,
        medium: grouped.medium.length,
        low: grouped.low.length,
        info: grouped.info.length
      },
      metadata: {
        scanDate: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        electronegativityVersion: await this.getElectronegativityVersion()
      }
    };
  }

  async getElectronegativityVersion() {
    return new Promise((resolve) => {
      const version = spawn('npx', ['electronegativity', '--version'], {
        stdio: 'pipe',
        shell: true
      });
      
      let output = '';
      version.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      version.on('close', () => {
        resolve(output.trim() || 'unknown');
      });
      
      // Timeout fallback
      setTimeout(() => resolve('unknown'), 5000);
    });
  }

  async generateReports() {
    // Save JSON report
    const jsonPath = path.join(CONFIG.outputDir, 'security-audit-full.json');
    await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));
    
    // Generate HTML report
    const htmlPath = path.join(CONFIG.outputDir, CONFIG.htmlReport);
    const htmlContent = this.generateHTMLReport();
    await fs.writeFile(htmlPath, htmlContent);
    
    console.log(`\n📄 Reports generated:`);
    console.log(`   - JSON: ${jsonPath}`);
    console.log(`   - HTML: ${htmlPath}`);
  }

  generateHTMLReport() {
    const { summary, grouped, metadata } = this.results;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Electron Security Audit Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: #2c3e50;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .metric-value {
      font-size: 36px;
      font-weight: bold;
      margin: 10px 0;
    }
    .metric-label {
      color: #666;
      text-transform: uppercase;
      font-size: 14px;
    }
    .critical { color: #e74c3c; }
    .high { color: #e67e22; }
    .medium { color: #f39c12; }
    .low { color: #3498db; }
    .info { color: #95a5a6; }
    .issue {
      background: white;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid;
    }
    .issue.critical { border-left-color: #e74c3c; }
    .issue.high { border-left-color: #e67e22; }
    .issue.medium { border-left-color: #f39c12; }
    .issue.low { border-left-color: #3498db; }
    .issue.info { border-left-color: #95a5a6; }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .issue-title {
      font-weight: bold;
      font-size: 18px;
    }
    .issue-location {
      color: #666;
      font-family: monospace;
      margin: 10px 0;
    }
    .issue-description {
      margin: 10px 0;
      line-height: 1.5;
    }
    .recommendations {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      margin-top: 10px;
    }
    .timestamp {
      color: #666;
      font-size: 14px;
      text-align: center;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔒 Electron Security Audit Report</h1>
    <p>Generated by Electronegativity on ${new Date(metadata.scanDate).toLocaleString()}</p>
    <p>Scan duration: ${(metadata.duration / 1000).toFixed(2)}s</p>
  </div>

  <div class="summary">
    <div class="metric">
      <div class="metric-label">Total Issues</div>
      <div class="metric-value">${summary.total}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Critical</div>
      <div class="metric-value critical">${summary.critical}</div>
    </div>
    <div class="metric">
      <div class="metric-label">High</div>
      <div class="metric-value high">${summary.high}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Medium</div>
      <div class="metric-value medium">${summary.medium}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Low</div>
      <div class="metric-value low">${summary.low}</div>
    </div>
  </div>

  ${this.generateIssuesHTML(grouped.critical, 'Critical Security Issues', 'critical')}
  ${this.generateIssuesHTML(grouped.high, 'High Security Issues', 'high')}
  ${this.generateIssuesHTML(grouped.medium, 'Medium Security Issues', 'medium')}
  ${this.generateIssuesHTML(grouped.low, 'Low Security Issues', 'low')}
  ${this.generateIssuesHTML(grouped.info, 'Informational', 'info')}

  <div class="timestamp">
    Report generated with Electronegativity ${metadata.electronegativityVersion}
  </div>
</body>
</html>
    `;
  }

  generateIssuesHTML(issues, title, severity) {
    if (issues.length === 0) return '';
    
    const issuesHTML = issues.map(issue => `
      <div class="issue ${severity}">
        <div class="issue-header">
          <div class="issue-title">${issue.id || issue.check || 'Security Issue'}</div>
          <div class="${severity}">${severity.toUpperCase()}</div>
        </div>
        ${issue.file ? `<div class="issue-location">📁 ${issue.file}${issue.line ? `:${issue.line}` : ''}</div>` : ''}
        <div class="issue-description">${issue.message || issue.description || 'No description available'}</div>
        ${this.getRecommendation(issue) ? `
          <div class="recommendations">
            <strong>Recommendation:</strong> ${this.getRecommendation(issue)}
          </div>
        ` : ''}
      </div>
    `).join('');
    
    return `
      <h2>${title}</h2>
      ${issuesHTML}
    `;
  }

  getRecommendation(issue) {
    // Check if issue matches known patterns
    const checkId = issue.id || issue.check || '';
    
    if (checkId.includes('CONTEXT_ISOLATION')) {
      return 'Enable context isolation in all BrowserWindow configurations: contextIsolation: true';
    }
    if (checkId.includes('NODE_INTEGRATION')) {
      return 'Disable node integration in renderer processes: nodeIntegration: false';
    }
    if (checkId.includes('WEB_SECURITY')) {
      return 'Never disable web security in production: webSecurity: true';
    }
    if (checkId.includes('REMOTE_MODULE')) {
      return 'The remote module is deprecated. Use IPC and contextBridge for secure communication.';
    }
    if (checkId.includes('INSECURE_CONTENT')) {
      return 'Prevent loading insecure content: allowRunningInsecureContent: false';
    }
    if (checkId.includes('OPEN_EXTERNAL')) {
      return 'Validate URLs before opening external links. Implement a whitelist of allowed protocols.';
    }
    if (checkId.includes('PERMISSION')) {
      return 'Implement proper permission request handlers for camera, microphone, etc.';
    }
    if (checkId.includes('CSP')) {
      return 'Define a strict Content Security Policy to prevent XSS attacks.';
    }
    
    return issue.recommendation || null;
  }

  checkThresholds() {
    const { summary } = this.results;
    let passed = true;
    
    console.log('\n🎯 Checking severity thresholds:');
    
    // Check each severity level
    for (const [severity, count] of Object.entries(summary)) {
      if (severity === 'total') continue;
      
      const threshold = CONFIG.severityThresholds[severity];
      if (threshold !== undefined && threshold !== -1) {
        const status = count <= threshold ? '✅' : '❌';
        console.log(`   ${status} ${severity.toUpperCase()}: ${count} found (threshold: ${threshold})`);
        
        if (count > threshold) {
          passed = false;
        }
      }
    }
    
    return passed;
  }

  printSummary() {
    const { summary } = this.results;
    
    console.log('\n📊 Security Audit Summary:');
    console.log('━'.repeat(50));
    console.log(`   Total Issues: ${summary.total}`);
    console.log(`   Critical: ${summary.critical}`);
    console.log(`   High: ${summary.high}`);
    console.log(`   Medium: ${summary.medium}`);
    console.log(`   Low: ${summary.low}`);
    console.log(`   Info: ${summary.info}`);
    console.log('━'.repeat(50));
    
    // Show top issues
    if (this.results.grouped.critical.length > 0) {
      console.log('\n⚠️  Critical issues found:');
      this.results.grouped.critical.slice(0, 3).forEach(issue => {
        console.log(`   - ${issue.message || issue.id}`);
        if (issue.file) console.log(`     in ${issue.file}`);
      });
    }
    
    if (this.results.grouped.high.length > 0) {
      console.log('\n⚠️  High severity issues found:');
      this.results.grouped.high.slice(0, 3).forEach(issue => {
        console.log(`   - ${issue.message || issue.id}`);
        if (issue.file) console.log(`     in ${issue.file}`);
      });
    }
  }
}

// Main execution
async function main() {
  const auditor = new SecurityAuditor();
  const passed = await auditor.run();
  
  if (!passed) {
    console.log('\n❌ Security audit failed! Fix the issues above before proceeding.');
    process.exit(1);
  } else {
    console.log('\n✅ Security audit passed!');
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

module.exports = { SecurityAuditor, CONFIG };