export default {
  // TypeScript files
  "**/*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    () => "tsc --noEmit", // Run type-checking
  ],
  // JavaScript files
  "**/*.{js,jsx}": ["eslint --fix", "prettier --write"],
  // JSON, CSS, SCSS, and MD files
  "**/*.{json,css,scss,md}": ["prettier --write"],
  // Package files
  "**/package.json": [
    "prettier --write",
    // You can add custom package.json validation here
  ],
};

/* Here's a detailed explanation of the pre-commit setup and its rationale:

Lint-staged Configuration (.lintstagedrc.js):
Runs specific checks only on staged files for better performance
Different checks for different file types:
TypeScript: ESLint, Prettier, and type checking
JavaScript: ESLint and Prettier
Other files (JSON, CSS, MD): Prettier only
Type checking ensures type safety before commits

Commit Message Convention (commitlint.config.js):
Enforces Conventional Commits standard
Defines allowed commit types (feat, fix, docs, etc.)
Ensures consistent commit message format
Makes changelog generation and semantic versioning easier

Pre-commit Hook (.husky/pre-commit):
Runs lint-staged for efficient code quality checks
Performs project-wide type checking
Runs tests related to changed files only
Provides clear error messages
Fails fast if any check fails

Commit Message Hook (.husky/commit-msg):
Validates commit messages against conventional commit rules
Ensures consistent commit history
Makes code review and maintenance easier

Benefits of this setup:
Performance: Only checks changed files when possible
Consistency: Enforces code style and commit message standards
Quality: Catches errors before they reach the repository
Maintainability: Makes the codebase easier to maintain and review
Automation: Integrates well with CI/CD and semantic versioning

To use this setup:
Commit messages should follow the format: type(scope): subject
Example: feat(auth): Add Google login support
Example: fix(ui): Correct button alignment

The pre-commit hook will:
Format your code
Fix auto-fixable linting issues
Run type checking
Run relevant tests

If any check fails:
You'll see clear error messages
The commit will be prevented
Fix the issues and try committing again
*/
