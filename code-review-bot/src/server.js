const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const diffAnalyzer = require('./analyzers/diffAnalyzer');
const codeQualityAnalyzer = require('./analyzers/codeQualityAnalyzer');
const securityScanner = require('./analyzers/securityScanner');
const formatComment = require('./utils/formatComment');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Verify GitHub webhook signature
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  const calculatedSignature = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
    next();
  } else {
    return res.status(401).send('Invalid signature');
  }
};

// Handle GitHub webhook events
app.post('/webhook', verifyWebhookSignature, async (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  // Only process pull request events
  if (event === 'pull_request' && 
      (payload.action === 'opened' || payload.action === 'synchronize')) {
    
    try {
      // Get PR details
      const { pull_request: pr } = payload;
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      const prNumber = pr.number;
      
      console.log(`Processing PR #${prNumber} in ${owner}/${repo}`);
      
      // Get the diff
      const { data: diff } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff'
        }
      });
      
      // Analyze the diff
      const diffSummary = await diffAnalyzer.analyze(diff);
      
      // Get the files changed in the PR
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Analyze code quality
      const qualitySuggestions = await codeQualityAnalyzer.analyze(files, owner, repo, prNumber);
      
      // Scan for security vulnerabilities
      const securityIssues = await securityScanner.scan(files, owner, repo, prNumber);
      
      // Format the comment
      const comment = formatComment({
        diffSummary,
        qualitySuggestions,
        securityIssues,
        prUrl: pr.html_url,
        prTitle: pr.title
      });
      
      // Post the comment to the PR
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment
      });
      
      console.log(`Successfully posted analysis for PR #${prNumber}`);
      
      res.status(200).send('PR processed successfully');
    } catch (error) {
      console.error('Error processing PR:', error);
      res.status(500).send('Error processing PR');
    }
  } else {
    // Acknowledge receipt of the webhook but take no action
    res.status(200).send('Event received');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Service is healthy');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // Export for testing 