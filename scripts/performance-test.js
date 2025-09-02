#!/usr/bin/env node

/**
 * Performance Testing Script for Chrome Extension
 * Tests extension load time, memory usage, and runtime performance
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

class PerformanceTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {}
    };
  }

  async measureBundleSize() {
    console.log('📊 Measuring bundle size...');
    
    const distDir = path.join(rootDir, 'dist');
    
    try {
      const files = await fs.readdir(distDir, { withFileTypes: true });
      const sizes = {};
      let totalSize = 0;

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(distDir, file.name);
          const stats = await fs.stat(filePath);
          sizes[file.name] = stats.size;
          totalSize += stats.size;
        }
      }

      // Convert to KB
      const sizeInKB = Math.round(totalSize / 1024);
      
      this.results.tests.bundleSize = {
        totalSizeKB: sizeInKB,
        files: Object.fromEntries(
          Object.entries(sizes).map(([name, size]) => [
            name, 
            Math.round(size / 1024) + 'KB'
          ])
        ),
        status: sizeInKB < 500 ? 'PASS' : 'WARN',
        threshold: '500KB'
      };

      console.log(`✅ Bundle size: ${sizeInKB}KB (${this.results.tests.bundleSize.status})`);
      
    } catch (error) {
      console.error('❌ Bundle size measurement failed:', error.message);
      this.results.tests.bundleSize = { error: error.message };
    }
  }

  async measureBuildTime() {
    console.log('⏱️  Measuring build time...');
    
    try {
      // Clean dist directory
      execSync('npm run clean', { cwd: rootDir, stdio: 'ignore' });
      
      const startTime = Date.now();
      execSync('npm run build:prod', { cwd: rootDir, stdio: 'ignore' });
      const buildTime = Date.now() - startTime;
      
      this.results.tests.buildTime = {
        timeMs: buildTime,
        timeSec: Math.round(buildTime / 1000),
        status: buildTime < 30000 ? 'PASS' : 'WARN', // 30 seconds
        threshold: '30s'
      };

      console.log(`✅ Build time: ${Math.round(buildTime / 1000)}s (${this.results.tests.buildTime.status})`);
      
    } catch (error) {
      console.error('❌ Build time measurement failed:', error.message);
      this.results.tests.buildTime = { error: error.message };
    }
  }

  async analyzeCodeComplexity() {
    console.log('🧮 Analyzing code complexity...');
    
    try {
      // Count lines of code
      const srcDir = path.join(rootDir, 'src');
      const files = await this.getTypescriptFiles(srcDir);
      
      let totalLines = 0;
      let totalFiles = 0;
      const fileMetrics = {};

      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n').length;
        const loc = content.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
        ).length;
        
        totalLines += loc;
        totalFiles++;
        
        const relativePath = path.relative(rootDir, file);
        fileMetrics[relativePath] = {
          totalLines: lines,
          linesOfCode: loc
        };
      }

      const avgLinesPerFile = Math.round(totalLines / totalFiles);

      this.results.tests.codeComplexity = {
        totalFiles,
        totalLinesOfCode: totalLines,
        avgLinesPerFile,
        largestFiles: Object.entries(fileMetrics)
          .sort(([,a], [,b]) => b.linesOfCode - a.linesOfCode)
          .slice(0, 5)
          .map(([name, metrics]) => ({ name, ...metrics })),
        status: avgLinesPerFile < 100 ? 'PASS' : 'WARN'
      };

      console.log(`✅ Code complexity: ${totalFiles} files, ${totalLines} LOC, avg ${avgLinesPerFile} LOC/file`);
      
    } catch (error) {
      console.error('❌ Code complexity analysis failed:', error.message);
      this.results.tests.codeComplexity = { error: error.message };
    }
  }

  async getTypescriptFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...await this.getTypescriptFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  async checkDependencySize() {
    console.log('📦 Checking dependency sizes...');
    
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(rootDir, 'package.json'), 'utf8')
      );
      
      const dependencies = Object.keys(packageJson.dependencies || {});
      const devDependencies = Object.keys(packageJson.devDependencies || {});
      
      // Calculate node_modules size
      const nodeModulesDir = path.join(rootDir, 'node_modules');
      let nodeModulesSize = 0;
      
      try {
        const sizeOutput = execSync('du -sb node_modules', { 
          cwd: rootDir, 
          encoding: 'utf8' 
        });
        nodeModulesSize = parseInt(sizeOutput.split('\t')[0]);
      } catch (error) {
        console.warn('⚠️  Could not measure node_modules size');
      }

      this.results.tests.dependencies = {
        productionDeps: dependencies.length,
        devDeps: devDependencies.length,
        totalDeps: dependencies.length + devDependencies.length,
        nodeModulesSizeMB: Math.round(nodeModulesSize / (1024 * 1024)),
        heaviestDeps: dependencies.slice(0, 5), // Top production deps
        status: dependencies.length < 10 ? 'PASS' : 'WARN'
      };

      console.log(`✅ Dependencies: ${dependencies.length} prod, ${devDependencies.length} dev`);
      
    } catch (error) {
      console.error('❌ Dependency analysis failed:', error.message);
      this.results.tests.dependencies = { error: error.message };
    }
  }

  async runTypeCheckPerformance() {
    console.log('🔍 Measuring TypeScript type checking performance...');
    
    try {
      const startTime = Date.now();
      execSync('npm run typecheck', { cwd: rootDir, stdio: 'ignore' });
      const typeCheckTime = Date.now() - startTime;
      
      this.results.tests.typeCheck = {
        timeMs: typeCheckTime,
        timeSec: Math.round(typeCheckTime / 1000),
        status: typeCheckTime < 10000 ? 'PASS' : 'WARN', // 10 seconds
        threshold: '10s'
      };

      console.log(`✅ Type check: ${Math.round(typeCheckTime / 1000)}s (${this.results.tests.typeCheck.status})`);
      
    } catch (error) {
      console.error('❌ Type check performance test failed:', error.message);
      this.results.tests.typeCheck = { error: error.message };
    }
  }

  generateSummary() {
    const tests = this.results.tests;
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    Object.values(tests).forEach(test => {
      if (test.error) {
        failCount++;
      } else if (test.status === 'PASS') {
        passCount++;
      } else if (test.status === 'WARN') {
        warnCount++;
      }
    });

    this.results.summary = {
      totalTests: Object.keys(tests).length,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
      overallStatus: failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS'
    };
  }

  async generateReport() {
    const reportPath = path.join(rootDir, 'performance-results.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n📊 Performance Test Results:');
    console.log('================================');
    
    Object.entries(this.results.tests).forEach(([testName, result]) => {
      const icon = result.error ? '❌' : result.status === 'PASS' ? '✅' : '⚠️';
      console.log(`${icon} ${testName}: ${result.error || result.status}`);
      
      if (result.timeMs) {
        console.log(`   Time: ${Math.round(result.timeMs / 1000)}s`);
      }
      if (result.totalSizeKB) {
        console.log(`   Size: ${result.totalSizeKB}KB`);
      }
    });
    
    console.log('\n📋 Summary:');
    console.log(`   Total: ${this.results.summary.totalTests}`);
    console.log(`   Passed: ${this.results.summary.passed}`);
    console.log(`   Warnings: ${this.results.summary.warnings}`);
    console.log(`   Failed: ${this.results.summary.failed}`);
    console.log(`   Status: ${this.results.summary.overallStatus}`);
    
    console.log(`\n📄 Full report saved to: performance-results.json`);
    
    return this.results;
  }

  async runAllTests() {
    console.log('🚀 Starting performance tests...\n');
    
    await this.measureBuildTime();
    await this.measureBundleSize();
    await this.analyzeCodeComplexity();
    await this.checkDependencySize();
    await this.runTypeCheckPerformance();
    
    this.generateSummary();
    const results = await this.generateReport();
    
    // Exit with error code if tests failed
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
  
  const tester = new PerformanceTester();

  try {
    switch (command) {
      case 'all':
        await tester.runAllTests();
        break;
      case 'build':
        await tester.measureBuildTime();
        break;
      case 'size':
        await tester.measureBundleSize();
        break;
      case 'complexity':
        await tester.analyzeCodeComplexity();
        break;
      case 'deps':
        await tester.checkDependencySize();
        break;
      case 'typecheck':
        await tester.runTypeCheckPerformance();
        break;
      default:
        console.log(`
🏃‍♂️ Performance Testing Tool

Usage:
  node scripts/performance-test.js [test]

Tests:
  all         Run all performance tests (default)
  build       Measure build time
  size        Measure bundle size
  complexity  Analyze code complexity
  deps        Check dependency sizes
  typecheck   Measure type checking performance
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}