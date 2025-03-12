import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { Octokit } from '@octokit/rest';
import { analyze } from './analyzers/diffAnalyzer.js';
import { analyze as analyzeCodeQuality } from './analyzers/codeQualityAnalyzer.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { formatComment } from './utils/formatComment.js';
import { scan as scanSecurity } from './analyzers/securityScanner.js';

// Load environment variables
dotenv.config();

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * Verify GitHub webhook signature
 * @param event - The API Gateway event
 * @returns Whether the signature is valid
 */
function verifyWebhookSignature(event: APIGatewayProxyEvent): boolean {
  const signature = event.headers['x-hub-signature-256'];
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET || '');
  const body = event.body || '';
  const calculatedSignature = 'sha256=' + hmac.update(body).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Lambda handler function
 * @param event - The API Gateway event
 * @returns API Gateway response
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Health check endpoint
  if (event.path === '/health' && event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'healthy' })
    };
  }
  
  // Verify webhook signature
  if (!verifyWebhookSignature(event)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' })
    };
  }
  
  // Parse event body
  const body = JSON.parse(event.body || '{}');
  const githubEvent = event.headers['x-github-event'];
  
  // Only process pull request events
  if (githubEvent === 'pull_request' && 
      (body.action === 'opened' || body.action === 'synchronize')) {
    
    try {
      // Get PR details
      const { pull_request: pr } = body;
      const repo = body.repository.name;
      const owner = body.repository.owner.login;
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
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'PR processed successfully' })
      };
    } catch (error) {
      console.error('Error processing PR:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error processing PR' })
      };
    }
  } else {
    // Acknowledge receipt of the webhook but take no action
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Event received' })
    };
  }
} 