# Tag - Smart Tab Management

Tag is a browser extension that helps you manage your tabs efficiently with intelligent grouping, suspension, and organization features.

## Features

- **Tab Management**: Organize and manage your browser tabs efficiently
- **Tab Suspension**: Automatically suspend inactive tabs to save memory
- **Tab Grouping**: Group related tabs together for better organization
- **Memory Usage Tracking**: Monitor and optimize browser memory usage
- **Keyboard Shortcuts**: Navigate and manage tabs quickly with keyboard shortcuts
- **Dark Mode Support**: Enjoy a comfortable browsing experience in any lighting condition

## Project Structure

This project is organized as a monorepo using pnpm workspaces:

```
tag/
├── apps/                  # Application packages
│   └── extension/         # Browser extension
│       └── entrypoints/   # Extension entry points (popup, tabs-modal, etc.)
├── packages/              # Shared libraries and components
│   ├── ui/                # UI components
│   └── ...
├── e2e/                   # End-to-end tests with Playwright
├── .changeset/            # Changeset files for versioning
├── scripts/               # Build and utility scripts
└── ...
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version specified in `.nvmrc`)
- [pnpm](https://pnpm.io/) (version 8.9.0 or later)
- [Git](https://git-scm.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/tag.git
   cd tag
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

### Building for Production

```bash
pnpm build
```

The built extension will be available in the `dist` folder.

## Development

### Commands

- `pnpm dev`: Start the development server
- `pnpm build`: Build the extension for production
- `pnpm lint`: Run linting
- `pnpm test`: Run tests
- `pnpm format`: Format code with Prettier
- `pnpm type-check`: Run TypeScript type checking

### Dependency Management

We use [npm-check-updates](https://github.com/raineorshine/npm-check-updates) to manage dependencies:

- `pnpm update-check`: Check for outdated dependencies
- `pnpm update-check:minor`: Check for minor updates only
- `pnpm update-check:patch`: Check for patch updates only
- `pnpm update-check:interactive`: Interactive update mode
- `pnpm update-deps`: Update all dependencies

### Versioning and Releases

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs:

- `pnpm changeset:add`: Add a new changeset
- `pnpm changeset:status`: Check the status of changesets
- `pnpm changeset:version`: Update versions based on changesets
- `pnpm changeset:publish`: Publish packages
- `pnpm release`: Build, version, and publish in one command

## Testing

### Unit Tests

```bash
pnpm test
```

### End-to-End Tests

We use Playwright for end-to-end testing, including accessibility testing with axe-core:

```bash
cd e2e
pnpm test
```

For more information on our accessibility testing approach, see [e2e/README.md](e2e/README.md).

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by various tab management extensions including:
  - [The Great Suspender](https://github.com/greatsuspender/thegreatsuspender)
  - [Tabli](https://github.com/antonycourtney/tabli)
  - [Tab Manager Plus](https://github.com/stefanXO/Tab-Manager-Plus)
