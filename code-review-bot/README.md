# Code Review Bot

A GitHub integration that automatically analyzes pull requests, generates comprehensive summaries of code changes, provides improvement suggestions, and checks for security vulnerabilities.

## Features

- **Diff Analysis**: Generates human-readable summaries of code changes
- **Code Quality Suggestions**: Identifies potential improvements and best practices
- **Security Vulnerability Scanning**: Detects common security issues
- **GitHub Integration**: Posts summaries directly to PR comments via webhooks
- **Customizable Rules**: Configure checks based on your project's needs
- **Support for Multiple Languages**: Works with JavaScript/TypeScript, Python, Go, and more

## Architecture

The system consists of:

1. **GitHub Webhook Listener**: Receives PR events from GitHub
2. **Diff Analyzer**: Processes code changes and generates summaries
3. **Code Quality Analyzer**: Provides suggestions for improvements
4. **Security Scanner**: Checks for potential vulnerabilities
5. **GitHub API Client**: Posts results back to the PR

## Getting Started

### Prerequisites

- Node.js 18+
- GitHub account with permissions to create webhooks
- (Optional) AWS account for serverless deployment

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/code-review-bot.git
cd code-review-bot

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your GitHub token and webhook secret
```

### Configuration

Edit `config.js` to customize:

- Languages to analyze
- Security checks to perform
- Code quality rules
- Comment formatting

### Running Locally

```bash
npm run dev
```

This starts a local server that can receive webhook events from GitHub. Use a tool like ngrok to expose your local server to the internet.

### Deployment

#### Serverless (AWS Lambda)

```bash
npm run deploy:serverless
```

#### Docker

```bash
docker build -t code-review-bot .
docker run -p 3000:3000 code-review-bot
```

## Setting Up GitHub Webhooks

1. Go to your GitHub repository settings
2. Navigate to "Webhooks" and click "Add webhook"
3. Set the Payload URL to your deployed service
4. Set Content type to `application/json`
5. Enter your secret (same as in your .env file)
6. Select "Let me select individual events" and choose:
   - Pull requests
   - Pull request reviews
7. Click "Add webhook"

## Usage

Once set up, the bot will automatically:

1. Analyze new PRs and PR updates
2. Generate a summary of changes
3. Provide code quality suggestions
4. Check for security vulnerabilities
5. Post results as a comment on the PR

## License

MIT 