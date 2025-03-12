#!/usr/bin/env node

/**
 * Script to check if changesets are needed for modified packages
 * 
 * This script:
 * 1. Identifies packages that have been modified since the last release
 * 2. Checks if there are changesets that cover these packages
 * 3. Reports packages that need changesets
 * 
 * Usage: pnpm changeset:check
 */

import { readFileSync, readdirSync } from 'fs';

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Types
interface Package {
  name: string;
  path: string;
}

interface Changeset {
  id: string;
  packages: string[];
}

interface PackageJson {
  name: string;
  private?: boolean;
  workspaces?: string[];
}

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const changesetDir = path.join(rootDir, '.changeset');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Main function
async function main(): Promise<void> {
  try {
    console.log(`\n${colors.bold}🔍 Checking for packages that need changesets...${colors.reset}\n`);
    
    // Get all packages in the monorepo
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as PackageJson;
    const workspaces = packageJson.workspaces || [];
    
    // Get all package directories
    const packageDirs: string[] = [];
    workspaces.forEach(workspace => {
      const basePath = workspace.replace(/\/\*$/, '');
      try {
        const dirs = readdirSync(path.join(rootDir, basePath), { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => path.join(basePath, dirent.name));
        packageDirs.push(...dirs);
      } catch (error) {
        console.warn(`Warning: Could not read workspace directory ${basePath}`);
      }
    });
    
    // Get modified packages
    const modifiedPackages = getModifiedPackages(packageDirs);
    
    if (modifiedPackages.length === 0) {
      console.log(`${colors.green}✅ No packages have been modified since the last release.${colors.reset}`);
      return;
    }
    
    console.log(`${colors.yellow}Modified packages:${colors.reset}`);
    modifiedPackages.forEach(pkg => {
      console.log(`  - ${pkg.name} (${pkg.path})`);
    });
    
    // Get existing changesets
    const changesets = getExistingChangesets();
    
    // Check which packages are covered by changesets
    const packagesWithChangesets = new Set<string>();
    changesets.forEach(changeset => {
      changeset.packages.forEach(pkg => {
        packagesWithChangesets.add(pkg);
      });
    });
    
    // Find packages that need changesets
    const packagesNeedingChangesets = modifiedPackages.filter(
      pkg => !packagesWithChangesets.has(pkg.name)
    );
    
    if (packagesNeedingChangesets.length === 0) {
      console.log(`\n${colors.green}✅ All modified packages have changesets.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ The following packages need changesets:${colors.reset}`);
      packagesNeedingChangesets.forEach(pkg => {
        console.log(`  - ${pkg.name} (${pkg.path})`);
      });
      
      console.log(`\n${colors.cyan}💡 Run the following command to create a changeset:${colors.reset}`);
      console.log(`  pnpm changeset:add`);
      
      // Exit with error code if packages need changesets
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Error checking for changesets:${colors.reset}`, (error as Error).message);
    process.exit(1);
  }
}

// Get packages that have been modified since the last release
function getModifiedPackages(packageDirs: string[]): Package[] {
  const modifiedPackages: Package[] = [];
  
  // Get the last release tag
  let lastReleaseTag: string;
  try {
    lastReleaseTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (error) {
    // If no tags exist, use the first commit
    lastReleaseTag = execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
  }
  
  // For each package, check if it has been modified
  packageDirs.forEach(packageDir => {
    try {
      const packageJsonPath = path.join(rootDir, packageDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
      
      // Skip private packages that aren't published
      if (packageJson.private === true) {
        return;
      }
      
      // Check if the package has been modified since the last release
      const result = execSync(
        `git diff --name-only ${lastReleaseTag} HEAD -- ${packageDir}`,
        { encoding: 'utf8' }
      );
      
      if (result.trim() !== '') {
        modifiedPackages.push({
          name: packageJson.name,
          path: packageDir,
        });
      }
    } catch (error) {
      // Skip packages without a package.json
    }
  });
  
  return modifiedPackages;
}

// Get existing changesets
function getExistingChangesets(): Changeset[] {
  const changesets: Changeset[] = [];
  
  try {
    const files = readdirSync(changesetDir)
      .filter(file => file.endsWith('.md') && file !== 'README.md');
    
    files.forEach(file => {
      const content = readFileSync(path.join(changesetDir, file), 'utf8');
      const lines = content.split('\n');
      
      // Parse the frontmatter to get the packages
      const packages: string[] = [];
      let inFrontmatter = false;
      
      for (const line of lines) {
        if (line.trim() === '---') {
          inFrontmatter = !inFrontmatter;
          continue;
        }
        
        if (inFrontmatter && line.includes(':')) {
          const [key, value] = line.split(':').map(part => part.trim());
          if (key !== 'release') {
            packages.push(key);
          }
        }
      }
      
      changesets.push({
        id: file.replace('.md', ''),
        packages,
      });
    });
  } catch (error) {
    console.warn(`Warning: Could not read changesets directory: ${(error as Error).message}`);
  }
  
  return changesets;
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 