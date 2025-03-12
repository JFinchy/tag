import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';

// Types
export interface CodeQualitySuggestion {
  filePath: string;
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
  lineNumbers?: number[];
}

export interface FileData {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * Analyzes files for code quality issues
 * @param files - The files changed in the PR
 * @param owner - The repository owner
 * @param repo - The repository name
 * @param prNumber - The PR number
 * @returns Code quality suggestions
 */
export async function analyze(
  files: FileData[],
  owner: string,
  repo: string,
  prNumber: number
): Promise<CodeQualitySuggestion[]> {
  try {
    const suggestions: CodeQualitySuggestion[] = [];
    
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
          
          // Analyze file for code quality issues
          const fileSuggestions = await analyzeFileQuality(file.filename, fileContent, file.patch);
          
          if (fileSuggestions.suggestions.length > 0) {
            suggestions.push(fileSuggestions);
          }
        } catch (error) {
          console.error(`Error analyzing ${file.filename} for code quality:`, error);
        }
      }));
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error analyzing code quality:', error);
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
 * Analyze a file for code quality issues
 * @param filePath - The file path
 * @param content - The file content
 * @param patch - The file patch
 * @returns Code quality suggestions
 */
async function analyzeFileQuality(
  filePath: string,
  content: string,
  patch: string
): Promise<CodeQualitySuggestion> {
  // Extract file extension
  const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
  
  // Skip files that are not code
  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'java', 'rb', 'php', 'c', 'cpp', 'cs', 'html', 'css', 'scss', 'sql'];
  if (!codeExtensions.includes(fileExtension)) {
    return {
      filePath,
      suggestions: [],
      priority: 'low'
    };
  }
  
  try {
    // Generate suggestions using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a code review assistant specializing in code quality. Analyze the following ${fileExtension} file and provide specific, actionable suggestions for improvement. Focus on:
          
          1. Code maintainability and readability
          2. Potential bugs or edge cases
          3. Performance issues
          4. Best practices for ${fileExtension} files
          5. Design patterns and architecture
          
          Provide up to 3 high-value suggestions, ordered by importance. Be specific and reference line numbers when possible.`
        },
        {
          role: "user",
          content: `File: ${filePath}\n\nContent:\n${content}\n\nChanges (patch):\n${patch}`
        }
      ],
      max_tokens: 500
    });
    
    const aiSuggestions = response.choices[0].message.content.trim();
    
    // Parse suggestions and extract line numbers
    const parsedSuggestions = parseSuggestions(aiSuggestions);
    
    return {
      filePath,
      suggestions: parsedSuggestions.suggestions,
      priority: determinePriority(parsedSuggestions.suggestions),
      lineNumbers: parsedSuggestions.lineNumbers
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath} for code quality:`, error);
    return {
      filePath,
      suggestions: [],
      priority: 'low'
    };
  }
}

/**
 * Parse suggestions from AI response
 * @param aiResponse - The AI response
 * @returns Parsed suggestions and line numbers
 */
function parseSuggestions(aiResponse: string): { suggestions: string[], lineNumbers: number[] } {
  const suggestions: string[] = [];
  const lineNumbers: number[] = [];
  
  // Split by numbered points or bullet points
  const suggestionRegex = /(?:\d+\.\s|\*\s)(.*?)(?=(?:\d+\.\s|\*\s|$))/gs;
  const matches = aiResponse.matchAll(suggestionRegex);
  
  for (const match of matches) {
    if (match[1]) {
      suggestions.push(match[1].trim());
      
      // Try to extract line numbers
      const lineNumberMatches = match[1].matchAll(/line\s+(\d+)/gi);
      for (const lineMatch of lineNumberMatches) {
        if (lineMatch[1]) {
          lineNumbers.push(parseInt(lineMatch[1], 10));
        }
      }
    }
  }
  
  // If regex didn't work, just use the whole response
  if (suggestions.length === 0 && aiResponse.trim()) {
    suggestions.push(aiResponse.trim());
  }
  
  return { suggestions, lineNumbers };
}

/**
 * Determine the priority of suggestions
 * @param suggestions - The suggestions
 * @returns The priority
 */
function determinePriority(suggestions: string[]): 'high' | 'medium' | 'low' {
  // Check for high priority keywords
  const highPriorityKeywords = [
    'security', 'vulnerability', 'crash', 'exception', 'error', 'bug', 'critical',
    'memory leak', 'performance issue', 'race condition', 'deadlock'
  ];
  
  // Check for medium priority keywords
  const mediumPriorityKeywords = [
    'refactor', 'maintainability', 'readability', 'best practice', 'code smell',
    'complexity', 'duplication', 'naming', 'documentation'
  ];
  
  const combinedSuggestions = suggestions.join(' ').toLowerCase();
  
  if (highPriorityKeywords.some(keyword => combinedSuggestions.includes(keyword))) {
    return 'high';
  }
  
  if (mediumPriorityKeywords.some(keyword => combinedSuggestions.includes(keyword))) {
    return 'medium';
  }
  
  return 'low';
} 