import { Octokit } from '@octokit/rest';
import { analyze } from './analyzers/diffAnalyzer.js';
import { analyze as analyzeCodeQuality } from './analyzers/codeQualityAnalyzer.js';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import { formatComment } from './utils/formatComment.js';
import { scan as scanSecurity } from './analyzers/securityScanner.js';

// Load environment variables
dotenv.config();

// Types
interface PullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    html_url: string;
    title: string;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
}

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Verify GitHub webhook signature
const verifyWebhookSignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET || '');
  const calculatedSignature = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  try {
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
      next();
    } else {
      return res.status(401).send('Invalid signature');
    }
  } catch (error) {
    return res.status(401).send('Signature verification failed');
  }
};

// Handle GitHub webhook events
app.post('/webhook', verifyWebhookSignature, async (req: express.Request, res: express.Response) => {
  const event = req.headers['x-github-event'] as string;
  const payload = req.body as PullRequestPayload;

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
      const diffSummary = await analyze(diff as string);
      
      // Get the files changed in the PR
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Analyze code quality
      const qualitySuggestions = await analyzeCodeQuality(files, owner, repo, prNumber);
      
      // Scan for security vulnerabilities
      const securityIssues = await scanSecurity(files, owner, repo, prNumber);
      
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
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.status(200).send('Service is healthy');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; // Export for testing 