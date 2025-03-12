# Contributing to Tag

Thank you for your interest in contributing to Tag! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Making Changes](#making-changes)
  - [Changesets](#changesets)
  - [Testing](#testing)
  - [Linting and Formatting](#linting-and-formatting)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Project Structure](#project-structure)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to foster an inclusive and respectful community.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version specified in `.nvmrc`)
- [pnpm](https://pnpm.io/) (version 8.9.0 or later)
- [Git](https://git-scm.com/)

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/tag.git
   cd tag
   ```
3. Add the original repository as a remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/tag.git
   ```
4. Install dependencies:
   ```bash
   pnpm install
   ```
5. Set up pre-commit hooks:
   ```bash
   pnpm prepare
   ```

## Development Workflow

### Branching Strategy

- `main` - The main development branch
- Feature branches - Create a new branch for each feature or bugfix

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bugfix-name
```

### Making Changes

1. Make sure you're on the latest version of `main`:
   ```bash
   git checkout main
   git pull upstream main
   ```
2. Create your feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Run tests and linting:
   ```bash
   pnpm test
   pnpm lint
   ```
5. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/) format:
   ```bash
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve issue with component"
   ```

### Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

After making changes to a package, add a changeset:

```bash
pnpm changeset:add
```

This will:
1. Prompt you to select the packages you've modified
2. Ask for the type of change (patch, minor, major)
3. Request a description of your changes for the changelog

### Testing

Run tests for all packages:

```bash
pnpm test
```

Or for a specific package:

```bash
cd packages/your-package
pnpm test
```

### Linting and Formatting

We use ESLint and Prettier to maintain code quality:

```bash
# Run linting
pnpm lint

# Format code
pnpm format
```

## Pull Request Process

1. Update your feature branch with the latest changes from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature-name
   git rebase main
   ```
2. Push your branch to your fork:
   ```bash
   git push -u origin feature/your-feature-name
   ```
3. Create a Pull Request from your fork to the original repository
4. Ensure all CI checks pass
5. Request a review from maintainers
6. Address any feedback from reviewers
7. Once approved, a maintainer will merge your PR

## Release Process

Releases are managed by the maintainers using the following process:

1. Collect and review all changesets
2. Run the version command to update package versions and generate changelogs:
   ```bash
   pnpm changeset:version
   ```
3. Publish the packages:
   ```bash
   pnpm release
   ```

## Project Structure

The repository is organized as a monorepo using pnpm workspaces:

```
tag/
├── apps/            # Application packages
│   └── extension/   # Browser extension
├── packages/        # Shared libraries and components
│   ├── ui/          # UI components
│   └── ...
├── e2e/             # End-to-end tests
├── .changeset/      # Changeset files
├── scripts/         # Build and utility scripts
└── ...
```

- `apps/`: Contains the main applications
- `packages/`: Contains shared libraries and components
- `e2e/`: Contains end-to-end tests
- `.changeset/`: Contains changeset files for versioning
- `scripts/`: Contains build and utility scripts

Thank you for contributing to Tag! 