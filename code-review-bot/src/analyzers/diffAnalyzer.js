const { parsePatch } = require('diff');
const { OpenAI } = require('openai');
const path = require('path');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyzes a diff and generates a human-readable summary
 * @param {string} diff - The diff content from GitHub
 * @returns {Promise<Object>} - Summary of the changes
 */
async function analyze(diff) {
  try {
    // Parse the diff
    const files = parseDiff(diff);
    
    // Generate statistics
    const stats = generateStats(files);
    
    // Group files by type/directory for better organization
    const fileGroups = groupFilesByType(files);
    
    // Generate summaries for each file using AI
    const fileSummaries = await generateFileSummaries(files);
    
    // Generate an overall summary using AI
    const overallSummary = await generateOverallSummary(files, stats);
    
    return {
      stats,
      fileGroups,
      fileSummaries,
      overallSummary
    };
  } catch (error) {
    console.error('Error analyzing diff:', error);
    return {
      error: 'Failed to analyze diff',
      details: error.message
    };
  }
}

/**
 * Parse the diff string into structured data
 * @param {string} diff - The diff content
 * @returns {Array} - Array of file changes
 */
function parseDiff(diff) {
  try {
    // Split the diff by file
    const filePatches = diff.split('diff --git').filter(Boolean);
    
    return filePatches.map(filePatch => {
      // Extract file path
      const filePathMatch = filePatch.match(/a\/(.*) b\/(.*)/);
      const filePath = filePathMatch ? filePathMatch[2] : 'unknown';
      
      // Determine if file was added, modified, or deleted
      const fileStatus = filePatch.includes('new file mode') ? 'added' :
                         filePatch.includes('deleted file mode') ? 'deleted' : 'modified';
      
      // Extract the actual changes
      const hunks = parsePatch(filePatch);
      
      // Extract added and removed lines
      let addedLines = 0;
      let removedLines = 0;
      let changes = [];
      
      hunks.forEach(hunk => {
        hunk.lines.forEach(line => {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            addedLines++;
            changes.push({ type: 'add', content: line.substring(1) });
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            removedLines++;
            changes.push({ type: 'remove', content: line.substring(1) });
          } else if (!line.startsWith('\\')) { // Ignore "No newline at end of file"
            changes.push({ type: 'context', content: line.substring(1) });
          }
        });
      });
      
      return {
        filePath,
        fileStatus,
        extension: path.extname(filePath).substring(1),
        addedLines,
        removedLines,
        changes
      };
    });
  } catch (error) {
    console.error('Error parsing diff:', error);
    return [];
  }
}

/**
 * Generate statistics about the changes
 * @param {Array} files - Array of file changes
 * @returns {Object} - Statistics about the changes
 */
function generateStats(files) {
  const stats = {
    totalFiles: files.length,
    addedFiles: 0,
    modifiedFiles: 0,
    deletedFiles: 0,
    totalAddedLines: 0,
    totalRemovedLines: 0,
    fileTypes: {}
  };
  
  files.forEach(file => {
    // Count file status
    if (file.fileStatus === 'added') stats.addedFiles++;
    else if (file.fileStatus === 'deleted') stats.deletedFiles++;
    else stats.modifiedFiles++;
    
    // Count lines
    stats.totalAddedLines += file.addedLines;
    stats.totalRemovedLines += file.removedLines;
    
    // Count file types
    const ext = file.extension || 'unknown';
    stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
  });
  
  return stats;
}

/**
 * Group files by type or directory for better organization
 * @param {Array} files - Array of file changes
 * @returns {Object} - Files grouped by type/directory
 */
function groupFilesByType(files) {
  const groups = {};
  
  files.forEach(file => {
    const dir = file.filePath.split('/')[0];
    if (!groups[dir]) {
      groups[dir] = [];
    }
    groups[dir].push(file);
  });
  
  return groups;
}

/**
 * Generate summaries for each file using AI
 * @param {Array} files - Array of file changes
 * @returns {Promise<Object>} - Summaries for each file
 */
async function generateFileSummaries(files) {
  const summaries = {};
  
  // Process files in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async file => {
      // Skip files that are too large or binary
      if (file.changes.length > 300) {
        summaries[file.filePath] = 'File too large to summarize';
        return;
      }
      
      try {
        // Format the changes for the AI
        const changesText = file.changes
          .map(change => `${change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' '} ${change.content}`)
          .join('\n');
        
        // Generate summary using OpenAI
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a code review assistant. Summarize the following code changes concisely and technically."
            },
            {
              role: "user",
              content: `Summarize the following changes to ${file.filePath} (${file.fileStatus}):\n\n${changesText}`
            }
          ],
          max_tokens: 150
        });
        
        summaries[file.filePath] = response.choices[0].message.content.trim();
      } catch (error) {
        console.error(`Error generating summary for ${file.filePath}:`, error);
        summaries[file.filePath] = 'Failed to generate summary';
      }
    }));
  }
  
  return summaries;
}

/**
 * Generate an overall summary of the changes using AI
 * @param {Array} files - Array of file changes
 * @param {Object} stats - Statistics about the changes
 * @returns {Promise<string>} - Overall summary
 */
async function generateOverallSummary(files, stats) {
  try {
    // Create a summary of the changes for the AI
    const fileChanges = files.map(file => 
      `${file.filePath} (${file.fileStatus}): +${file.addedLines}, -${file.removedLines} lines`
    ).join('\n');
    
    // Generate summary using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a code review assistant. Provide a concise, high-level summary of the changes in this pull request."
        },
        {
          role: "user",
          content: `Summarize the following pull request changes:\n\nStats:\n- ${stats.totalFiles} files changed (${stats.addedFiles} added, ${stats.modifiedFiles} modified, ${stats.deletedFiles} deleted)\n- +${stats.totalAddedLines}, -${stats.totalRemovedLines} lines\n\nFiles:\n${fileChanges}`
        }
      ],
      max_tokens: 250
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating overall summary:', error);
    return 'Failed to generate overall summary';
  }
}

module.exports = {
  analyze
}; 