#!/usr/bin/env node

/**
 * Chrome Web Store Deployment Script
 * Handles multi-environment deployment with automated version management
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

class ExtensionDeployer {
  constructor() {
    this.environments = {
      development: {
        manifestPath: 'public/manifest.dev.json',
        buildCommand: 'npm run build',
        publish: false
      },
      staging: {
        manifestPath: 'public/manifest.staging.json', 
        buildCommand: 'npm run build:prod',
        publish: false
      },
      production: {
        manifestPath: 'public/manifest.json',
        buildCommand: 'npm run build:prod',
        publish: true
      }
    };
  }

  async getCurrentVersion() {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(rootDir, 'package.json'), 'utf8')
    );
    return packageJson.version;
  }

  async updateVersion(type = 'patch') {
    console.log(`🔄 Updating version (${type})...`);
    
    try {
      execSync(`npm version ${type} --no-git-tag-version`, { 
        cwd: rootDir,
        stdio: 'inherit' 
      });
      
      const newVersion = await this.getCurrentVersion();
      console.log(`✅ Version updated to ${newVersion}`);
      return newVersion;
    } catch (error) {
      console.error('❌ Failed to update version:', error.message);
      throw error;
    }
  }

  async updateManifestVersion(manifestPath, version) {
    const fullPath = path.join(rootDir, manifestPath);
    
    try {
      const manifest = JSON.parse(await fs.readFile(fullPath, 'utf8'));
      manifest.version = version;
      
      await fs.writeFile(fullPath, JSON.stringify(manifest, null, 2));
      console.log(`✅ Updated manifest version to ${version}`);
    } catch (error) {
      console.error(`❌ Failed to update manifest: ${error.message}`);
      throw error;
    }
  }

  async buildExtension(environment) {
    const config = this.environments[environment];
    if (!config) {
      throw new Error(`Unknown environment: ${environment}`);
    }

    console.log(`🏗️  Building for ${environment}...`);
    
    try {
      execSync(config.buildCommand, { 
        cwd: rootDir,
        stdio: 'inherit' 
      });
      
      // Copy manifest and assets
      await this.copyAssets(config.manifestPath);
      console.log(`✅ Build completed for ${environment}`);
    } catch (error) {
      console.error(`❌ Build failed: ${error.message}`);
      throw error;
    }
  }

  async copyAssets(manifestPath) {
    const distDir = path.join(rootDir, 'dist');
    
    // Copy manifest
    await fs.copyFile(
      path.join(rootDir, manifestPath),
      path.join(distDir, 'manifest.json')
    );
    
    // Copy icons
    try {
      await fs.cp(
        path.join(rootDir, 'icons'),
        path.join(distDir, 'icons'),
        { recursive: true }
      );
    } catch (error) {
      console.warn('⚠️  Icons directory not found, skipping...');
    }
  }

  async packageExtension(version, environment) {
    const packageName = `faf-extension-${environment}-v${version}.zip`;
    const packagePath = path.join(rootDir, packageName);
    
    console.log(`📦 Creating package: ${packageName}...`);
    
    try {
      execSync(`cd dist && zip -r ../${packageName} .`, { 
        cwd: rootDir,
        stdio: 'inherit' 
      });
      
      console.log(`✅ Package created: ${packageName}`);
      return packagePath;
    } catch (error) {
      console.error(`❌ Packaging failed: ${error.message}`);
      throw error;
    }
  }

  async validateExtension() {
    console.log('🔍 Validating extension...');
    
    const distDir = path.join(rootDir, 'dist');
    const requiredFiles = [
      'manifest.json',
      'service-worker.js',
      'content.js',
      'popup.js',
      'popup.html'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(distDir, file);
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    // Validate manifest
    const manifest = JSON.parse(
      await fs.readFile(path.join(distDir, 'manifest.json'), 'utf8')
    );
    
    if (manifest.manifest_version !== 3) {
      throw new Error('Only Manifest V3 is supported');
    }
    
    console.log('✅ Extension validation passed');
  }

  async generateChangelog(version) {
    console.log('📝 Generating changelog...');
    
    try {
      // Get recent commits
      const commits = execSync(
        'git log --pretty=format:"%s" --since="1 week ago"',
        { cwd: rootDir, encoding: 'utf8' }
      ).split('\n').filter(line => line.trim());
      
      const changelog = [
        `# Release ${version}`,
        '',
        '## Changes:',
        ...commits.map(commit => `- ${commit}`)
      ].join('\n');
      
      await fs.writeFile(
        path.join(rootDir, `CHANGELOG-${version}.md`),
        changelog
      );
      
      console.log(`✅ Changelog generated: CHANGELOG-${version}.md`);
    } catch (error) {
      console.warn('⚠️  Could not generate changelog:', error.message);
    }
  }

  async deploy(environment, options = {}) {
    const {
      updateVersionType = 'patch',
      skipVersionUpdate = false,
      skipValidation = false
    } = options;

    console.log(`🚀 Starting deployment to ${environment}...`);
    
    try {
      // Update version if needed
      let version;
      if (!skipVersionUpdate && environment === 'production') {
        version = await this.updateVersion(updateVersionType);
      } else {
        version = await this.getCurrentVersion();
      }

      // Update manifest version
      const config = this.environments[environment];
      await this.updateManifestVersion(config.manifestPath, version);

      // Build extension
      await this.buildExtension(environment);

      // Validate extension
      if (!skipValidation) {
        await this.validateExtension();
      }

      // Package extension
      const packagePath = await this.packageExtension(version, environment);

      // Generate changelog for production
      if (environment === 'production') {
        await this.generateChangelog(version);
      }

      console.log(`✅ Deployment to ${environment} completed successfully!`);
      console.log(`📦 Package: ${path.basename(packagePath)}`);
      
      return {
        version,
        packagePath,
        environment
      };

    } catch (error) {
      console.error(`❌ Deployment to ${environment} failed:`, error.message);
      throw error;
    }
  }

  async rollback(version, environment = 'production') {
    console.log(`🔄 Rolling back ${environment} to version ${version}...`);
    
    try {
      // Revert package.json version
      const packageJson = JSON.parse(
        await fs.readFile(path.join(rootDir, 'package.json'), 'utf8')
      );
      packageJson.version = version;
      await fs.writeFile(
        path.join(rootDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Revert manifest version
      const config = this.environments[environment];
      await this.updateManifestVersion(config.manifestPath, version);

      // Rebuild with reverted version
      await this.buildExtension(environment);
      await this.packageExtension(version, environment);

      console.log(`✅ Rollback to ${version} completed`);
    } catch (error) {
      console.error(`❌ Rollback failed: ${error.message}`);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1] || 'development';
  
  const deployer = new ExtensionDeployer();

  try {
    switch (command) {
      case 'deploy':
        const options = {};
        if (args.includes('--major')) options.updateVersionType = 'major';
        if (args.includes('--minor')) options.updateVersionType = 'minor';
        if (args.includes('--skip-version')) options.skipVersionUpdate = true;
        if (args.includes('--skip-validation')) options.skipValidation = true;
        
        await deployer.deploy(environment, options);
        break;
        
      case 'rollback':
        const version = args[2];
        if (!version) {
          console.error('❌ Version required for rollback');
          process.exit(1);
        }
        await deployer.rollback(version, environment);
        break;
        
      case 'validate':
        await deployer.validateExtension();
        break;
        
      default:
        console.log(`
🚀 FAF Extension Deployment Tool

Usage:
  node scripts/deploy.js <command> [environment] [options]

Commands:
  deploy      Deploy to environment (development|staging|production)
  rollback    Rollback to specific version
  validate    Validate built extension

Options:
  --major           Major version bump
  --minor           Minor version bump  
  --skip-version    Skip version update
  --skip-validation Skip validation

Examples:
  node scripts/deploy.js deploy development
  node scripts/deploy.js deploy production --minor
  node scripts/deploy.js rollback production 1.2.3
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ExtensionDeployer;