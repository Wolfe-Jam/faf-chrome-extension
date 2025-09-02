#!/usr/bin/env node

/**
 * Security Check Script for Chrome Extension
 * Validates extension security best practices and compliance
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

class SecurityChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        passed: 0,
        warnings: 0,
        failed: 0,
        total: 0
      }
    };
  }

  async checkManifestSecurity() {
    console.log('🔍 Checking manifest security...');
    
    try {
      const manifestPath = path.join(rootDir, 'public/manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      const issues = [];
      const warnings = [];

      // Check for overly broad permissions
      if (manifest.host_permissions?.includes('<all_urls>')) {
        warnings.push('Uses <all_urls> permission - consider restricting to specific domains');
      }

      // Check for sensitive permissions
      const sensitivePermissions = ['history', 'bookmarks', 'tabs', 'webNavigation', 'privacy', 'management', 'debugger'];
      const usedSensitivePerms = manifest.permissions?.filter(perm => 
        sensitivePermissions.includes(perm)
      ) || [];

      if (usedSensitivePerms.length > 0) {
        warnings.push(`Uses sensitive permissions: ${usedSensitivePerms.join(', ')}`);
      }

      // Check for unsafe CSP
      if (manifest.content_security_policy) {
        if (manifest.content_security_policy.includes('unsafe-eval') ||
            manifest.content_security_policy.includes('unsafe-inline')) {
          issues.push('Content Security Policy allows unsafe-eval or unsafe-inline');
        }
      }

      // Check for externally connectable domains
      if (manifest.externally_connectable?.matches) {
        const broadMatches = manifest.externally_connectable.matches.filter(match => 
          match.includes('*') && !match.startsWith('*://localhost')
        );
        if (broadMatches.length > 0) {
          warnings.push(`Broad externally_connectable matches: ${broadMatches.join(', ')}`);
        }
      }

      // Check manifest version
      if (manifest.manifest_version !== 3) {
        issues.push('Should use Manifest V3 for better security');
      }

      this.results.checks.manifest = {
        status: issues.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS',
        issues,
        warnings,
        permissions: manifest.permissions || [],
        hostPermissions: manifest.host_permissions || [],
        manifestVersion: manifest.manifest_version
      };

      console.log(`✅ Manifest security check completed (${this.results.checks.manifest.status})`);

    } catch (error) {
      this.results.checks.manifest = {
        status: 'FAIL',
        error: error.message
      };
      console.error('❌ Manifest security check failed:', error.message);
    }
  }

  async checkCodeSecurity() {
    console.log('🔍 Checking code security...');
    
    try {
      const srcDir = path.join(rootDir, 'src');
      const files = await this.getSourceFiles(srcDir);
      
      const issues = [];
      const warnings = [];
      const sensitivePatterns = [
        { pattern: /eval\s*\(/, severity: 'high', message: 'eval() usage detected' },
        { pattern: /innerHTML\s*=/, severity: 'medium', message: 'innerHTML assignment (XSS risk)' },
        { pattern: /document\.write\s*\(/, severity: 'high', message: 'document.write() usage' },
        { pattern: /\.execCommand\s*\(/, severity: 'medium', message: 'execCommand() usage' },
        { pattern: /postMessage\s*\(/, severity: 'low', message: 'postMessage() usage - verify origin checks' },
        { pattern: /chrome\.tabs\.executeScript/, severity: 'medium', message: 'Script injection - verify input sanitization' },
        { pattern: /(password|secret|token|key)\s*[:=]\s*['"'][^'"]{8,}/, severity: 'high', message: 'Potential hardcoded secrets' },
        { pattern: /fetch\s*\(\s*[^)]*['"]\s*\+/, severity: 'medium', message: 'Dynamic URL construction in fetch()' },
        { pattern: /localStorage\.setItem\s*\(.*password|token|secret/, severity: 'medium', message: 'Sensitive data in localStorage' }
      ];

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        const relativePath = path.relative(rootDir, filePath);
        
        for (const { pattern, severity, message } of sensitivePatterns) {
          const matches = content.match(pattern);
          if (matches) {
            // Check if marked as safe
            const lines = content.split('\n');
            let hasSafeComment = false;
            
            for (let i = 0; i < lines.length; i++) {
              if (pattern.test(lines[i]) && (
                lines[i].includes('// safe:') || 
                (i > 0 && lines[i-1].includes('// safe:'))
              )) {
                hasSafeComment = true;
                break;
              }
            }

            if (!hasSafeComment) {
              const item = { file: relativePath, message, severity, line: this.getLineNumber(content, matches[0]) };
              
              if (severity === 'high') {
                issues.push(item);
              } else {
                warnings.push(item);
              }
            }
          }
        }
      }

      this.results.checks.code = {
        status: issues.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS',
        issues,
        warnings,
        filesScanned: files.length
      };

      console.log(`✅ Code security check completed (${this.results.checks.code.status})`);

    } catch (error) {
      this.results.checks.code = {
        status: 'FAIL',
        error: error.message
      };
      console.error('❌ Code security check failed:', error.message);
    }
  }

  async checkDependencySecurity() {
    console.log('🔍 Checking dependency security...');
    
    try {
      // Run npm audit
      let auditResults;
      try {
        const auditOutput = execSync('npm audit --json', { 
          cwd: rootDir,
          encoding: 'utf8'
        });
        auditResults = JSON.parse(auditOutput);
      } catch (auditError) {
        // npm audit returns non-zero exit code when vulnerabilities found
        if (auditError.stdout) {
          auditResults = JSON.parse(auditError.stdout);
        } else {
          throw auditError;
        }
      }

      const vulnerabilities = auditResults.vulnerabilities || {};
      const highSeverity = Object.values(vulnerabilities).filter(v => v.severity === 'high' || v.severity === 'critical');
      const mediumSeverity = Object.values(vulnerabilities).filter(v => v.severity === 'moderate');
      
      // Check package.json for known problematic packages
      const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const riskyPackages = [
        'lodash', 'moment', 'request', 'node-sass'
      ].filter(pkg => allDeps[pkg]);

      this.results.checks.dependencies = {
        status: highSeverity.length > 0 ? 'FAIL' : mediumSeverity.length > 0 ? 'WARN' : 'PASS',
        totalVulnerabilities: Object.keys(vulnerabilities).length,
        highSeverity: highSeverity.length,
        mediumSeverity: mediumSeverity.length,
        riskyPackages,
        auditSummary: auditResults.metadata
      };

      console.log(`✅ Dependency security check completed (${this.results.checks.dependencies.status})`);

    } catch (error) {
      this.results.checks.dependencies = {
        status: 'FAIL',
        error: error.message
      };
      console.error('❌ Dependency security check failed:', error.message);
    }
  }

  async checkBuildSecurity() {
    console.log('🔍 Checking build security...');
    
    try {
      const distDir = path.join(rootDir, 'dist');
      const issues = [];
      const warnings = [];

      // Check if dist directory exists
      try {
        await fs.access(distDir);
      } catch {
        // Build first
        execSync('npm run build:prod', { cwd: rootDir, stdio: 'ignore' });
      }

      // Check for source maps in production
      const files = await fs.readdir(distDir, { recursive: true });
      const sourceMaps = files.filter(file => file.endsWith('.map'));
      
      if (sourceMaps.length > 0) {
        warnings.push(`Source maps found in build: ${sourceMaps.join(', ')}`);
      }

      // Check for unminified files
      for (const file of files) {
        if (file.endsWith('.js') && !file.includes('service-worker')) {
          const filePath = path.join(distDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Simple heuristic for minified code
          const avgLineLength = content.length / content.split('\n').length;
          if (avgLineLength < 50) {
            warnings.push(`File may not be minified: ${file}`);
          }
        }
      }

      // Check for debug statements
      for (const file of files) {
        if (file.endsWith('.js')) {
          const filePath = path.join(distDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          if (content.includes('console.log') || content.includes('debugger')) {
            issues.push(`Debug statements found in production build: ${file}`);
          }
        }
      }

      this.results.checks.build = {
        status: issues.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS',
        issues,
        warnings,
        sourceMaps: sourceMaps.length,
        totalFiles: files.length
      };

      console.log(`✅ Build security check completed (${this.results.checks.build.status})`);

    } catch (error) {
      this.results.checks.build = {
        status: 'FAIL',
        error: error.message
      };
      console.error('❌ Build security check failed:', error.message);
    }
  }

  async checkPrivacyCompliance() {
    console.log('🔍 Checking privacy compliance...');
    
    try {
      const srcDir = path.join(rootDir, 'src');
      const files = await this.getSourceFiles(srcDir);
      
      const issues = [];
      const warnings = [];
      const privacyPatterns = [
        { pattern: /navigator\.userAgent/, message: 'User agent collection' },
        { pattern: /navigator\.geolocation/, message: 'Geolocation access' },
        { pattern: /localStorage\.setItem.*email|phone|name/, message: 'PII storage in localStorage' },
        { pattern: /chrome\.history/, message: 'Browsing history access' },
        { pattern: /chrome\.cookies/, message: 'Cookie access' },
        { pattern: /fetch.*analytics|tracking|telemetry/, message: 'Analytics/tracking requests' }
      ];

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        const relativePath = path.relative(rootDir, filePath);
        
        for (const { pattern, message } of privacyPatterns) {
          if (pattern.test(content)) {
            warnings.push({
              file: relativePath,
              message,
              note: 'Ensure proper privacy disclosure and user consent'
            });
          }
        }
      }

      // Check for privacy policy reference
      const manifestPath = path.join(rootDir, 'public/manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      if (!manifest.homepage_url && warnings.length > 0) {
        issues.push('No privacy policy URL found in manifest despite data collection');
      }

      this.results.checks.privacy = {
        status: issues.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS',
        issues,
        warnings,
        hasPrivacyPolicy: !!manifest.homepage_url
      };

      console.log(`✅ Privacy compliance check completed (${this.results.checks.privacy.status})`);

    } catch (error) {
      this.results.checks.privacy = {
        status: 'FAIL',
        error: error.message
      };
      console.error('❌ Privacy compliance check failed:', error.message);
    }
  }

  async getSourceFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        files.push(...await this.getSourceFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  getLineNumber(content, searchString) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchString)) {
        return i + 1;
      }
    }
    return 1;
  }

  generateSummary() {
    const checks = this.results.checks;
    let passed = 0, warnings = 0, failed = 0;

    Object.values(checks).forEach(check => {
      if (check.status === 'PASS') passed++;
      else if (check.status === 'WARN') warnings++;
      else if (check.status === 'FAIL') failed++;
    });

    this.results.summary = {
      passed,
      warnings, 
      failed,
      total: Object.keys(checks).length,
      overallStatus: failed > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS'
    };
  }

  async generateReport() {
    const reportPath = path.join(rootDir, 'security-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n🛡️ Security Check Results:');
    console.log('==========================');
    
    Object.entries(this.results.checks).forEach(([checkName, result]) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} ${checkName}: ${result.status}`);
      
      if (result.issues?.length > 0) {
        result.issues.forEach(issue => {
          console.log(`   ❌ ${typeof issue === 'string' ? issue : issue.message}`);
        });
      }
      
      if (result.warnings?.length > 0) {
        result.warnings.slice(0, 3).forEach(warning => {
          console.log(`   ⚠️  ${typeof warning === 'string' ? warning : warning.message}`);
        });
        if (result.warnings.length > 3) {
          console.log(`   ... and ${result.warnings.length - 3} more warnings`);
        }
      }
    });
    
    console.log('\n📊 Summary:');
    console.log(`   Passed: ${this.results.summary.passed}`);
    console.log(`   Warnings: ${this.results.summary.warnings}`);
    console.log(`   Failed: ${this.results.summary.failed}`);
    console.log(`   Overall: ${this.results.summary.overallStatus}`);
    
    console.log(`\n📄 Full report saved to: security-report.json`);
    
    return this.results;
  }

  async runAllChecks() {
    console.log('🛡️ Starting security checks...\n');
    
    await this.checkManifestSecurity();
    await this.checkCodeSecurity();
    await this.checkDependencySecurity();
    await this.checkBuildSecurity();
    await this.checkPrivacyCompliance();
    
    this.generateSummary();
    const results = await this.generateReport();
    
    // Exit with error code if checks failed
    if (this.results.summary.overallStatus === 'FAIL') {
      process.exit(1);
    }
    
    return results;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  const checker = new SecurityChecker();

  try {
    switch (command) {
      case 'all':
        await checker.runAllChecks();
        break;
      case 'manifest':
        await checker.checkManifestSecurity();
        break;
      case 'code':
        await checker.checkCodeSecurity();
        break;
      case 'deps':
        await checker.checkDependencySecurity();
        break;
      case 'build':
        await checker.checkBuildSecurity();
        break;
      case 'privacy':
        await checker.checkPrivacyCompliance();
        break;
      default:
        console.log(`
🛡️ Security Check Tool

Usage:
  node scripts/security-check.js [check]

Checks:
  all         Run all security checks (default)
  manifest    Check manifest.json security
  code        Check source code security  
  deps        Check dependency vulnerabilities
  build       Check build artifacts security
  privacy     Check privacy compliance
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Security check failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}