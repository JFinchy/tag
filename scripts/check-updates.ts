#!/usr/bin/env node

/**
 * Advanced dependency update checker script
 * 
 * Features:
 * - Check for updates without modifying package.json
 * - Update dependencies in package.json
 * - Filter by dependency type (prod, dev, peer, optional)
 * - Exclude specific packages
 * - Target specific update types (patch, minor, major)
 * - Interactive mode
 * - Format output with colors
 * - Check workspace packages
 * 
 * Usage examples:
 * - Basic check: pnpm update-check
 * - Update package.json: pnpm update-deps
 * - Check only patch updates: pnpm update-check:patch
 * - Check only minor updates: pnpm update-check:minor
 * - Interactive mode: pnpm update-check:interactive
 * - Custom exclude: pnpm update-check --exclude "eslint,typescript"
 * - Only dev dependencies: pnpm update-check --dep dev
 * - Check specific package: pnpm update-check --filter "react"
 * - Check workspace packages: pnpm update-check --workspace
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync } from 'fs';

// Types
interface Options {
  upgrade: boolean;
  interactive: boolean;
  target: string | null;
  exclude: string;
  dep: string | null;
  filter: string | null;
  workspace: boolean;
  format: string;
}

interface PackageJson {
  workspaces?: string[];
  [key: string]: unknown;
}

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = parseArgs(args);

// Default excluded packages - add any packages you always want to exclude here
const DEFAULT_EXCLUDED: string[] = [
  // Add packages that should be excluded by default
  // Example: 'typescript@beta'
];

// Main function
async function main(): Promise<void> {
  try {
    console.log('\n🔍 Checking for dependency updates...\n');
    
    // Build the command
    const command = buildCommand(options);
    
    // Execute the command
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    
    // Display results
    console.log(output);
    
    if (options.upgrade) {
      console.log('\n✅ Dependencies updated in package.json files');
      console.log('📦 Run your package manager install command to apply the updates');
    } else {
      console.log('\n💡 To update package.json files, run: pnpm update-deps');
    }
    
    // Provide additional information based on options
    if (options.target) {
      console.log(`\nℹ️  Only showing ${options.target} updates`);
    }
    
    if (options.exclude) {
      console.log(`\nℹ️  Excluded packages: ${options.exclude.split(',').join(', ')}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error checking for updates:', (error as Error).message);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(args: string[]): Options {
  const options: Options = {
    upgrade: false,
    interactive: false,
    target: null,
    exclude: DEFAULT_EXCLUDED.join(','),
    dep: null,
    filter: null,
    workspace: false,
    format: 'group',
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--upgrade':
        options.upgrade = true;
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--target':
        options.target = args[++i];
        break;
      case '--exclude':
        // Combine default excluded with user excluded
        const userExcluded = args[++i];
        options.exclude = DEFAULT_EXCLUDED.concat(userExcluded.split(',')).join(',');
        break;
      case '--dep':
        options.dep = args[++i];
        break;
      case '--filter':
        options.filter = args[++i];
        break;
      case '--workspace':
        options.workspace = true;
        break;
      case '--format':
        options.format = args[++i];
        break;
      default:
        // Handle flags without explicit option name
        if (arg.startsWith('--')) {
          const flagName = arg.slice(2);
          if (['patch', 'minor', 'major'].includes(flagName)) {
            options.target = flagName;
          }
        }
    }
  }
  
  return options;
}

// Build the command to execute
function buildCommand(options: Options): string {
  // Start with the base command
  let command = 'npx npm-check-updates';
  
  // Add format option
  command += ` --format ${options.format}`;
  
  // Add color
  command += ' --color';
  
  // Add upgrade flag if specified
  if (options.upgrade) {
    command += ' --upgrade';
  }
  
  // Add interactive mode if specified
  if (options.interactive) {
    command += ' --interactive';
  }
  
  // Add target if specified
  if (options.target) {
    command += ` --target ${options.target}`;
  }
  
  // Add excluded packages if specified
  if (options.exclude && options.exclude.length > 0) {
    command += ` --reject ${options.exclude}`;
  }
  
  // Add dependency type if specified
  if (options.dep) {
    command += ` --dep ${options.dep}`;
  }
  
  // Add filter if specified
  if (options.filter) {
    command += ` --filter ${options.filter}`;
  }
  
  // Handle workspace packages
  if (options.workspace) {
    // Read the workspace configuration
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as PackageJson;
    const workspaces = packageJson.workspaces || [];
    
    if (workspaces.length > 0) {
      // Create a command that checks each workspace
      const workspaceCommands = workspaces.map(workspace => {
        // Replace glob patterns with specific directories
        const workspacePath = workspace.replace(/\*$/, '');
        return `find ${workspacePath} -name "package.json" -not -path "*/node_modules/*" -exec dirname {} \\; | xargs -I {} sh -c 'echo "\\n📦 Checking {}"; cd {} && ${command}'`;
      });
      
      return workspaceCommands.join(' && ');
    }
  }
  
  return command;
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 