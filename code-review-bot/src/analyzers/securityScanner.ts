import { FileData } from './codeQualityAnalyzer.js';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';

// Types
export interface SecurityIssue {
  filePath: string;
  issues: Array<{
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    lineNumbers?: number[];
    cwe?: string; // Common Weakness Enumeration ID
    remediation?: string;
  }>;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Common security patterns to check for
const securityPatterns = {
  javascript: [
    { pattern: /eval\s*\(/g, description: 'Use of eval() can lead to code injection', severity: 'high', cwe: 'CWE-95' },
    { pattern: /document\.write\s*\(/g, description: 'document.write() can enable XSS attacks', severity: 'medium', cwe: 'CWE-79' },
    { pattern: /innerHTML\s*=/g, description: 'innerHTML can lead to XSS vulnerabilities', severity: 'medium', cwe: 'CWE-79' },
    { pattern: /exec\s*\(/g, description: 'Command execution can lead to injection attacks', severity: 'high', cwe: 'CWE-78' },
    { pattern: /password.*=.*['"][^'"]*['"]|secret.*=.*['"][^'"]*['"]|api[_-]?key.*=.*['"][^'"]*['"]/gi, description: 'Hardcoded credentials detected', severity: 'critical', cwe: 'CWE-798' }
  ],
  python: [
    { pattern: /exec\s*\(/g, description: 'Use of exec() can lead to code injection', severity: 'high', cwe: 'CWE-95' },
    { pattern: /eval\s*\(/g, description: 'Use of eval() can lead to code injection', severity: 'high', cwe: 'CWE-95' },
    { pattern: /os\.system\s*\(/g, description: 'Command execution can lead to injection attacks', severity: 'high', cwe: 'CWE-78' },
    { pattern: /subprocess\.call\s*\(/g, description: 'Command execution can lead to injection attacks', severity: 'high', cwe: 'CWE-78' },
    { pattern: /password.*=.*['"][^'"]*['"]|secret.*=.*['"][^'"]*['"]|api[_-]?key.*=.*['"][^'"]*['"]/gi, description: 'Hardcoded credentials detected', severity: 'critical', cwe: 'CWE-798' }
  ],
  sql: [
    { pattern: /SELECT.*FROM.*WHERE.*=.*\+/g, description: 'Potential SQL injection through string concatenation', severity: 'high', cwe: 'CWE-89' },
    { pattern: /EXECUTE\s+IMMEDIATE/gi, description: 'Dynamic SQL execution can lead to SQL injection', severity: 'high', cwe: 'CWE-89' }
  ],
  general: [
    { pattern: /TODO|FIXME|XXX|BUG|HACK/g, description: 'Code contains TODO/FIXME comments that might indicate unresolved issues', severity: 'low' }
  ]
};

/**
 * Scans files for security vulnerabilities
 * @param files - The files changed in the PR
 * @param owner - The repository owner
 * @param repo - The repository name
 * @param prNumber - The PR number
 * @returns Security issues found
 */
export async function scan(
  files: FileData[],
  owner: string,
  repo: string,
  prNumber: number
): Promise<SecurityIssue[]> {
  try {
    const securityIssues: SecurityIssue[] = [];
    
    // Process files in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async file => {
        // Skip files that are too large, binary, or deleted
        if (!file.patch || file.status === 'removed') {
          return;
        }
        
        try {
          // Get file content
          const fileContent = await getFileContent(owner, repo, file.filename, prNumber);
          
          // Skip if file content couldn't be retrieved
          if (!fileContent) {
            return;
          }
          
          // Scan file for security issues
          const fileIssues = await scanFileForSecurityIssues(file.filename, fileContent);
          
          if (fileIssues.issues.length > 0) {
            securityIssues.push(fileIssues);
          }
        } catch (error) {
          console.error(`Error scanning ${file.filename} for security issues:`, error);
        }
      }));
    }
    
    return securityIssues;
  } catch (error) {
    console.error('Error scanning for security issues:', error);
    return [];
  }
}

/**
 * Get the content of a file
 * @param owner - The repository owner
 * @param repo - The repository name
 * @param path - The file path
 * @param prNumber - The PR number
 * @returns The file content
 */
async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  prNumber: number
): Promise<string | null> {
  try {
    // Try to get the file content from the PR
    const { data } = await octokit.pulls.getFiles({
      owner,
      repo,
      pull_number: prNumber,
      path
    });
    
    if (data.length > 0 && data[0].raw_url) {
      const response = await fetch(data[0].raw_url);
      return await response.text();
    }
    
    // If not found in PR, try to get from repository
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path
    });
    
    if ('content' in fileData && fileData.content) {
      return Buffer.from(fileData.content, 'base64').toString();
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting content for ${path}:`, error);
    return null;
  }
}

/**
 * Scan a file for security issues
 * @param filePath - The file path
 * @param content - The file content
 * @returns Security issues found
 */
async function scanFileForSecurityIssues(
  filePath: string,
  content: string
): Promise<SecurityIssue> {
  // Extract file extension
  const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
  
  const issues: SecurityIssue['issues'] = [];
  
  // Apply pattern-based checks
  applySecurityPatterns(fileExtension, content, issues);
  
  // Use AI to find more complex security issues
  const aiIssues = await findSecurityIssuesWithAI(filePath, fileExtension, content);
  
  // Combine pattern-based and AI-based issues
  issues.push(...aiIssues);
  
  return {
    filePath,
    issues
  };
}

/**
 * Apply security patterns to find issues
 * @param fileExtension - The file extension
 * @param content - The file content
 * @param issues - The issues array to populate
 */
function applySecurityPatterns(
  fileExtension: string,
  content: string,
  issues: SecurityIssue['issues']
): void {
  // Map file extension to pattern category
  let patternCategory = 'general';
  if (['js', 'jsx', 'ts', 'tsx'].includes(fileExtension)) {
    patternCategory = 'javascript';
  } else if (['py'].includes(fileExtension)) {
    patternCategory = 'python';
  } else if (['sql'].includes(fileExtension)) {
    patternCategory = 'sql';
  }
  
  // Apply general patterns to all files
  applyPatternsFromCategory('general', content, issues);
  
  // Apply language-specific patterns
  if (patternCategory !== 'general') {
    applyPatternsFromCategory(patternCategory, content, issues);
  }
}

/**
 * Apply patterns from a specific category
 * @param category - The pattern category
 * @param content - The file content
 * @param issues - The issues array to populate
 */
function applyPatternsFromCategory(
  category: string,
  content: string,
  issues: SecurityIssue['issues']
): void {
  const patterns = securityPatterns[category as keyof typeof securityPatterns] || [];
  
  patterns.forEach(pattern => {
    const matches = content.matchAll(pattern.pattern);
    let matchFound = false;
    const lineNumbers: number[] = [];
    
    for (const match of matches) {
      matchFound = true;
      
      // Try to find line number
      if (match.index !== undefined) {
        const contentUpToMatch = content.substring(0, match.index);
        const lineNumber = (contentUpToMatch.match(/\n/g) || []).length + 1;
        lineNumbers.push(lineNumber);
      }
    }
    
    if (matchFound) {
      issues.push({
        description: pattern.description,
        severity: pattern.severity as 'critical' | 'high' | 'medium' | 'low',
        lineNumbers: lineNumbers.length > 0 ? lineNumbers : undefined,
        cwe: pattern.cwe,
        remediation: pattern.remediation
      });
    }
  });
}

/**
 * Find security issues using AI
 * @param filePath - The file path
 * @param fileExtension - The file extension
 * @param content - The file content
 * @returns Security issues found
 */
async function findSecurityIssuesWithAI(
  filePath: string,
  fileExtension: string,
  content: string
): Promise<SecurityIssue['issues']> {
  try {
    // Skip large files to avoid token limits
    if (content.length > 10000) {
      return [{
        description: 'File too large for AI security analysis',
        severity: 'low'
      }];
    }
    
    // Generate security analysis using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a security expert specializing in code security analysis. Analyze the following ${fileExtension} file for security vulnerabilities. Focus on:
          
          1. Injection vulnerabilities (SQL, command, code)
          2. Authentication and authorization issues
          3. Sensitive data exposure
          4. Security misconfigurations
          5. Cross-site scripting (XSS)
          6. Insecure deserialization
          7. Using components with known vulnerabilities
          8. Insufficient logging and monitoring
          
          For each issue found, provide:
          1. A clear description of the vulnerability
          2. The severity (critical, high, medium, low)
          3. The line number(s) if applicable
          4. The CWE (Common Weakness Enumeration) ID if known
          5. Remediation advice
          
          Format your response as a numbered list of issues. If no issues are found, state "No security issues detected."`
        },
        {
          role: "user",
          content: `File: ${filePath}\n\nContent:\n${content}`
        }
      ],
      max_tokens: 1000
    });
    
    const aiResponse = response.choices[0].message.content.trim();
    
    // Parse AI response
    return parseAISecurityResponse(aiResponse);
  } catch (error) {
    console.error(`Error analyzing ${filePath} for security issues with AI:`, error);
    return [];
  }
}

/**
 * Parse AI security response
 * @param aiResponse - The AI response
 * @returns Parsed security issues
 */
function parseAISecurityResponse(aiResponse: string): SecurityIssue['issues'] {
  // If no issues detected
  if (aiResponse.includes('No security issues detected')) {
    return [];
  }
  
  const issues: SecurityIssue['issues'] = [];
  
  // Try to parse numbered list format
  const issueRegex = /(\d+)\.\s+(.*?)(?=(?:\d+\.\s+|$))/gs;
  const matches = aiResponse.matchAll(issueRegex);
  
  for (const match of matches) {
    if (match[2]) {
      const issueText = match[2].trim();
      
      // Extract severity
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (issueText.toLowerCase().includes('critical')) severity = 'critical';
      else if (issueText.toLowerCase().includes('high')) severity = 'high';
      else if (issueText.toLowerCase().includes('low')) severity = 'low';
      
      // Extract line numbers
      const lineNumbers: number[] = [];
      const lineNumberMatches = issueText.matchAll(/line\s+(\d+)/gi);
      for (const lineMatch of lineNumberMatches) {
        if (lineMatch[1]) {
          lineNumbers.push(parseInt(lineMatch[1], 10));
        }
      }
      
      // Extract CWE
      let cwe: string | undefined;
      const cweMatch = issueText.match(/CWE-(\d+)/i);
      if (cweMatch && cweMatch[1]) {
        cwe = `CWE-${cweMatch[1]}`;
      }
      
      // Extract remediation advice
      let remediation: string | undefined;
      const remediationMatch = issueText.match(/remediation:?\s+(.*?)(?=(?:severity|cwe|line|$))/i);
      if (remediationMatch && remediationMatch[1]) {
        remediation = remediationMatch[1].trim();
      }
      
      issues.push({
        description: issueText,
        severity,
        lineNumbers: lineNumbers.length > 0 ? lineNumbers : undefined,
        cwe,
        remediation
      });
    }
  }
  
  // If regex didn't work, just use the whole response
  if (issues.length === 0 && aiResponse.trim()) {
    issues.push({
      description: aiResponse.trim(),
      severity: 'medium'
    });
  }
  
  return issues;
} 