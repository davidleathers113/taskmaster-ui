/**
 * Content Security Policy (CSP) Testing for Electron Applications
 * 
 * Following 2025 best practices:
 * - Strict CSP with nonces
 * - Testing for common bypass vulnerabilities
 * - JSONP endpoint detection
 * - Unsafe directive detection
 * - Compliance with security standards
 */

const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csp-parse');
const crypto = require('crypto');

// CSP Security Requirements for Electron 2025
const CSP_REQUIREMENTS = {
  // Required directives
  required: [
    'default-src',
    'script-src',
    'style-src',
    'img-src',
    'connect-src',
    'font-src',
    'object-src',
    'frame-ancestors'
  ],
  
  // Forbidden unsafe directives
  forbidden: {
    'script-src': ['unsafe-inline', 'unsafe-eval'],
    'style-src': ['unsafe-inline'],
    'default-src': ['*', 'data:', 'blob:']
  },
  
  // Recommended strict values
  recommended: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-'", "'strict-dynamic'"],
    'style-src': ["'self'", "'nonce-'"],
    'img-src': ["'self'", "data:", "https:"],
    'connect-src': ["'self'", "wss:", "https:"],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  },
  
  // Known bypass patterns
  bypassPatterns: [
    // CDNs that allow user uploads
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'jsdelivr.net',
    'raw.githubusercontent.com',
    
    // JSONP endpoints
    'callback=',
    'jsonp=',
    '.json?',
    'api.*callback',
    
    // Unsafe schemes
    'filesystem:',
    'blob:',
    'data:text/html',
    'javascript:'
  ]
};

class CSPSecurityTester {
  constructor() {
    this.results = {
      passed: true,
      violations: [],
      warnings: [],
      info: [],
      cspPolicies: [],
      score: 100,
      compliance: {
        owaspTop10: true,
        electronSecurity: true,
        strictCSP: false
      }
    };
  }

  async run(projectRoot = process.cwd()) {
    console.log('🔒 Starting CSP Security Testing for Electron App...\n');
    
    try {
      // 1. Find and analyze CSP configurations
      await this.findCSPConfigurations(projectRoot);
      
      // 2. Analyze each CSP policy
      for (const policy of this.results.cspPolicies) {
        await this.analyzeCSP(policy);
      }
      
      // 3. Test for Electron-specific CSP issues
      await this.testElectronCSP(projectRoot);
      
      // 4. Check for bypass vulnerabilities
      await this.checkBypassVulnerabilities();
      
      // 5. Generate compliance report
      this.generateComplianceReport();
      
      // 6. Calculate final score
      this.calculateScore();
      
      // 7. Generate reports
      await this.generateReports(projectRoot);
      
      // Print summary
      this.printSummary();
      
      return this.results.passed;
    } catch (error) {
      console.error('❌ CSP testing failed:', error.message);
      return false;
    }
  }

  /**
   * Find CSP configurations in the project
   */
  async findCSPConfigurations(projectRoot) {
    console.log('🔍 Searching for CSP configurations...');
    
    const cspLocations = [
      // HTML files
      { pattern: '**/*.html', type: 'html' },
      // JavaScript files (BrowserWindow configurations)
      { pattern: '**/main*.{js,ts}', type: 'electron-main' },
      { pattern: '**/preload*.{js,ts}', type: 'electron-preload' },
      // Configuration files
      { pattern: '**/csp.config.{js,json}', type: 'config' },
      { pattern: '**/security.config.{js,json}', type: 'config' }
    ];
    
    for (const location of cspLocations) {
      await this.searchForCSP(projectRoot, location);
    }
    
    if (this.results.cspPolicies.length === 0) {
      this.results.violations.push({
        severity: 'critical',
        message: 'No Content Security Policy found',
        recommendation: 'Implement a strict CSP to protect against XSS attacks'
      });
      this.results.passed = false;
    }
    
    console.log(`Found ${this.results.cspPolicies.length} CSP configurations\n`);
  }

  async searchForCSP(projectRoot, location) {
    const glob = require('glob');
    const files = glob.sync(location.pattern, {
      cwd: projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });
    
    for (const file of files) {
      const filePath = path.join(projectRoot, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Extract CSP based on file type
      const policies = this.extractCSP(content, location.type);
      
      policies.forEach(policy => {
        this.results.cspPolicies.push({
          file: file,
          type: location.type,
          policy: policy,
          parsed: this.parseCSP(policy)
        });
      });
    }
  }

  extractCSP(content, type) {
    const policies = [];
    
    switch (type) {
      case 'html':
        // Look for meta tags
        const metaRegex = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/gi;
        let match;
        while ((match = metaRegex.exec(content)) !== null) {
          policies.push(match[1]);
        }
        break;
        
      case 'electron-main':
        // Look for webPreferences.contentSecurityPolicy
        const cspRegex = /contentSecurityPolicy\s*:\s*["'`]([^"'`]+)["'`]/g;
        let electronMatch;
        while ((electronMatch = cspRegex.exec(content)) !== null) {
          policies.push(electronMatch[1]);
        }
        
        // Also check for session.defaultSession.webRequest patterns
        const sessionRegex = /setResponseHeader.*Content-Security-Policy.*["'`]([^"'`]+)["'`]/g;
        let sessionMatch;
        while ((sessionMatch = sessionRegex.exec(content)) !== null) {
          policies.push(sessionMatch[1]);
        }
        break;
        
      case 'config':
        // Try to parse as JSON or JS module
        try {
          const configData = JSON.parse(content);
          if (configData.csp) policies.push(configData.csp);
          if (configData.contentSecurityPolicy) policies.push(configData.contentSecurityPolicy);
        } catch {
          // Not JSON, try regex for JS exports
          const exportRegex = /(?:export\s+(?:default\s+)?|module\.exports\s*=\s*).*csp['"]\s*:\s*["'`]([^"'`]+)["'`]/g;
          let exportMatch;
          while ((exportMatch = exportRegex.exec(content)) !== null) {
            policies.push(exportMatch[1]);
          }
        }
        break;
    }
    
    return policies;
  }

  parseCSP(policyString) {
    try {
      return parse(policyString);
    } catch {
      // Fallback to manual parsing
      const directives = {};
      const parts = policyString.split(';').map(p => p.trim()).filter(Boolean);
      
      parts.forEach(part => {
        const [directive, ...values] = part.split(/\s+/);
        if (directive) {
          directives[directive] = values;
        }
      });
      
      return directives;
    }
  }

  /**
   * Analyze a CSP policy for security issues
   */
  async analyzeCSP(policyConfig) {
    console.log(`📋 Analyzing CSP from ${policyConfig.file}...`);
    
    const { parsed } = policyConfig;
    
    // Check for required directives
    CSP_REQUIREMENTS.required.forEach(directive => {
      if (!parsed[directive]) {
        this.results.violations.push({
          severity: 'high',
          file: policyConfig.file,
          message: `Missing required directive: ${directive}`,
          recommendation: `Add ${directive} with restrictive values`
        });
      }
    });
    
    // Check for forbidden values
    Object.entries(CSP_REQUIREMENTS.forbidden).forEach(([directive, forbidden]) => {
      const values = parsed[directive] || [];
      forbidden.forEach(forbiddenValue => {
        if (values.includes(forbiddenValue)) {
          this.results.violations.push({
            severity: 'critical',
            file: policyConfig.file,
            message: `Unsafe directive found: ${directive} contains '${forbiddenValue}'`,
            recommendation: `Remove '${forbiddenValue}' and use nonces or 'strict-dynamic' instead`
          });
          this.results.passed = false;
        }
      });
    });
    
    // Check for overly permissive policies
    this.checkPermissivePolicies(parsed, policyConfig.file);
    
    // Check for nonce implementation
    this.checkNonceImplementation(parsed, policyConfig.file);
    
    // Check for recommended values
    this.checkRecommendedValues(parsed, policyConfig.file);
  }

  checkPermissivePolicies(parsed, file) {
    // Check for wildcard in critical directives
    const criticalDirectives = ['default-src', 'script-src', 'style-src', 'connect-src'];
    
    criticalDirectives.forEach(directive => {
      const values = parsed[directive] || [];
      
      // Check for wildcards
      if (values.includes('*') || values.some(v => v.includes('*') && !v.includes('.'))) {
        this.results.violations.push({
          severity: 'high',
          file,
          message: `Overly permissive ${directive} with wildcard`,
          recommendation: 'Specify exact domains instead of wildcards'
        });
      }
      
      // Check for http:// (should be https://)
      if (values.some(v => v.startsWith('http://'))) {
        this.results.warnings.push({
          severity: 'medium',
          file,
          message: `Insecure HTTP protocol in ${directive}`,
          recommendation: 'Use HTTPS for all external resources'
        });
      }
    });
  }

  checkNonceImplementation(parsed, file) {
    const scriptSrc = parsed['script-src'] || [];
    const styleSrc = parsed['style-src'] || [];
    
    const hasScriptNonce = scriptSrc.some(v => v.includes("'nonce-"));
    const hasStyleNonce = styleSrc.some(v => v.includes("'nonce-"));
    
    if (!hasScriptNonce && !scriptSrc.includes("'strict-dynamic'")) {
      this.results.warnings.push({
        severity: 'medium',
        file,
        message: 'No nonce or strict-dynamic for script-src',
        recommendation: 'Implement nonce-based CSP for better security'
      });
    }
    
    if (!hasStyleNonce && styleSrc.includes("'unsafe-inline'")) {
      this.results.warnings.push({
        severity: 'medium',
        file,
        message: 'Style-src uses unsafe-inline without nonces',
        recommendation: 'Implement nonce-based styles or external stylesheets'
      });
    }
  }

  checkRecommendedValues(parsed, file) {
    Object.entries(CSP_REQUIREMENTS.recommended).forEach(([directive, recommended]) => {
      const actual = parsed[directive] || [];
      
      // Check if directive follows recommendations
      const followsRecommendation = recommended.every(rec => 
        rec.includes('nonce') || actual.includes(rec)
      );
      
      if (!followsRecommendation && actual.length > 0) {
        this.results.info.push({
          file,
          message: `${directive} could be more restrictive`,
          recommendation: `Consider using: ${directive} ${recommended.join(' ')}`
        });
      }
    });
  }

  /**
   * Test Electron-specific CSP issues
   */
  async testElectronCSP(projectRoot) {
    console.log('🔌 Testing Electron-specific CSP configurations...\n');
    
    // Find main process files
    const mainFiles = require('glob').sync('**/main*.{js,ts}', {
      cwd: projectRoot,
      ignore: ['**/node_modules/**', '**/dist/**']
    });
    
    for (const file of mainFiles) {
      const content = await fs.readFile(path.join(projectRoot, file), 'utf8');
      
      // Check for missing CSP in BrowserWindow
      if (content.includes('new BrowserWindow') && !content.includes('contentSecurityPolicy')) {
        this.results.warnings.push({
          severity: 'high',
          file,
          message: 'BrowserWindow created without explicit CSP',
          recommendation: 'Set contentSecurityPolicy in webPreferences'
        });
      }
      
      // Check for webSecurity disabled
      if (content.includes('webSecurity: false') || content.includes('webSecurity:false')) {
        this.results.violations.push({
          severity: 'critical',
          file,
          message: 'webSecurity is disabled',
          recommendation: 'Never disable webSecurity in production'
        });
        this.results.passed = false;
      }
      
      // Check for allowRunningInsecureContent
      if (content.includes('allowRunningInsecureContent: true')) {
        this.results.violations.push({
          severity: 'high',
          file,
          message: 'allowRunningInsecureContent is enabled',
          recommendation: 'Disable allowRunningInsecureContent'
        });
      }
    }
  }

  /**
   * Check for CSP bypass vulnerabilities
   */
  async checkBypassVulnerabilities() {
    console.log('🔍 Checking for CSP bypass vulnerabilities...\n');
    
    for (const policy of this.results.cspPolicies) {
      const { parsed, file } = policy;
      
      // Check each directive for bypass patterns
      Object.entries(parsed).forEach(([directive, values]) => {
        values.forEach(value => {
          CSP_REQUIREMENTS.bypassPatterns.forEach(pattern => {
            if (value.includes(pattern)) {
              this.results.violations.push({
                severity: 'high',
                file,
                message: `Potential CSP bypass: ${directive} includes '${pattern}'`,
                recommendation: 'Remove or restrict access to user-controllable endpoints'
              });
            }
          });
        });
      });
      
      // Check for JSONP endpoints
      const scriptSrc = parsed['script-src'] || [];
      const connectSrc = parsed['connect-src'] || [];
      
      [...scriptSrc, ...connectSrc].forEach(src => {
        if (src.includes('cdn') || src.includes('api')) {
          this.results.warnings.push({
            severity: 'medium',
            file,
            message: `External API/CDN in CSP: ${src}`,
            recommendation: 'Verify that endpoints cannot serve user-controlled content'
          });
        }
      });
    }
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport() {
    // Check OWASP Top 10 compliance
    this.results.compliance.owaspTop10 = 
      !this.results.violations.some(v => v.severity === 'critical') &&
      this.results.cspPolicies.length > 0;
    
    // Check Electron security compliance
    this.results.compliance.electronSecurity = 
      !this.results.violations.some(v => 
        v.message.includes('webSecurity') || 
        v.message.includes('allowRunningInsecureContent')
      );
    
    // Check strict CSP compliance
    this.results.compliance.strictCSP = 
      this.results.cspPolicies.some(p => {
        const parsed = p.parsed;
        return (
          parsed['script-src']?.includes("'strict-dynamic'") ||
          parsed['script-src']?.some(v => v.includes("'nonce-"))
        );
      });
  }

  /**
   * Calculate security score
   */
  calculateScore() {
    let score = 100;
    
    // Deduct points for violations
    this.results.violations.forEach(violation => {
      switch (violation.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });
    
    // Deduct points for warnings
    this.results.warnings.forEach(warning => {
      score -= 3;
    });
    
    // Bonus points for strict CSP
    if (this.results.compliance.strictCSP) {
      score += 10;
    }
    
    this.results.score = Math.max(0, Math.min(100, score));
    this.results.passed = this.results.score >= 70 && 
                          !this.results.violations.some(v => v.severity === 'critical');
  }

  /**
   * Generate reports
   */
  async generateReports(projectRoot) {
    const outputDir = path.join(projectRoot, 'test-results', 'security');
    await fs.mkdir(outputDir, { recursive: true });
    
    // JSON report
    const jsonPath = path.join(outputDir, 'csp-security-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));
    
    // HTML report
    const htmlPath = path.join(outputDir, 'csp-security-report.html');
    await fs.writeFile(htmlPath, this.generateHTMLReport());
    
    // Generate CSP recommendation
    const recommendedCSP = this.generateRecommendedCSP();
    const cspPath = path.join(outputDir, 'recommended-csp.txt');
    await fs.writeFile(cspPath, recommendedCSP);
    
    console.log('📄 Reports generated:');
    console.log(`   - JSON: ${jsonPath}`);
    console.log(`   - HTML: ${htmlPath}`);
    console.log(`   - Recommended CSP: ${cspPath}\n`);
  }

  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CSP Security Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #1a1a1a; color: white; padding: 20px; border-radius: 8px; }
    .score { font-size: 48px; font-weight: bold; color: ${this.results.score >= 70 ? '#10b981' : '#ef4444'}; }
    .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .violation { border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; background: #fef2f2; }
    .warning { border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; background: #fffbeb; }
    .info { border-left: 4px solid #3b82f6; padding: 10px; margin: 10px 0; background: #eff6ff; }
    .critical { color: #dc2626; font-weight: bold; }
    .high { color: #ea580c; font-weight: bold; }
    .medium { color: #f59e0b; }
    .compliance { display: flex; gap: 20px; }
    .compliance-item { padding: 10px 20px; border-radius: 4px; }
    .pass { background: #10b981; color: white; }
    .fail { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Content Security Policy Security Report</h1>
    <div class="score">Score: ${this.results.score}/100</div>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>Compliance Status</h2>
    <div class="compliance">
      <div class="compliance-item ${this.results.compliance.owaspTop10 ? 'pass' : 'fail'}">
        OWASP Top 10: ${this.results.compliance.owaspTop10 ? 'PASS' : 'FAIL'}
      </div>
      <div class="compliance-item ${this.results.compliance.electronSecurity ? 'pass' : 'fail'}">
        Electron Security: ${this.results.compliance.electronSecurity ? 'PASS' : 'FAIL'}
      </div>
      <div class="compliance-item ${this.results.compliance.strictCSP ? 'pass' : 'fail'}">
        Strict CSP: ${this.results.compliance.strictCSP ? 'PASS' : 'FAIL'}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Violations (${this.results.violations.length})</h2>
    ${this.results.violations.map(v => `
      <div class="violation">
        <div class="${v.severity}">${v.severity.toUpperCase()}: ${v.message}</div>
        <div>File: ${v.file || 'N/A'}</div>
        <div>Recommendation: ${v.recommendation}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>Warnings (${this.results.warnings.length})</h2>
    ${this.results.warnings.map(w => `
      <div class="warning">
        <div class="${w.severity}">${w.message}</div>
        <div>File: ${w.file || 'N/A'}</div>
        <div>Recommendation: ${w.recommendation}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>CSP Policies Found</h2>
    ${this.results.cspPolicies.map(p => `
      <div class="info">
        <strong>File:</strong> ${p.file}<br>
        <strong>Type:</strong> ${p.type}<br>
        <strong>Policy:</strong> <code>${p.policy}</code>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;
  }

  generateRecommendedCSP() {
    const nonce = crypto.randomBytes(16).toString('base64');
    
    return `# Recommended Strict Content Security Policy for Electron Apps (2025)

# Basic strict CSP with nonces
default-src 'self';
script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http:;
style-src 'self' 'nonce-${nonce}';
img-src 'self' data: https:;
font-src 'self';
connect-src 'self' wss: https:;
media-src 'self';
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;

# For Electron main process (in webPreferences):
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'nonce-GENERATED_NONCE' 'strict-dynamic'; style-src 'self' 'nonce-GENERATED_NONCE'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
}

# Implementation notes:
1. Generate a new nonce for each page load
2. Add nonce attribute to all inline scripts and styles
3. Use 'strict-dynamic' to allow dynamically created scripts
4. Never use 'unsafe-inline' or 'unsafe-eval'
5. Restrict connect-src to specific API endpoints
6. Use HTTPS for all external resources
7. Implement CSP reporting: report-uri /csp-violation-report-endpoint/
`;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log('\n📊 CSP Security Test Summary:');
    console.log('━'.repeat(50));
    console.log(`   Security Score: ${this.results.score}/100`);
    console.log(`   Status: ${this.results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Policies Found: ${this.results.cspPolicies.length}`);
    console.log(`   Violations: ${this.results.violations.length}`);
    console.log(`   Warnings: ${this.results.warnings.length}`);
    console.log('━'.repeat(50));
    
    if (!this.results.passed) {
      console.log('\n❌ Critical issues found:');
      this.results.violations
        .filter(v => v.severity === 'critical')
        .forEach(v => console.log(`   - ${v.message}`));
    }
  }
}

// Main execution
async function main() {
  const tester = new CSPSecurityTester();
  const passed = await tester.run();
  
  process.exit(passed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { CSPSecurityTester, CSP_REQUIREMENTS };