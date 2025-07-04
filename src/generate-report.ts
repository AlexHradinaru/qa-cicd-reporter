import * as core from '@actions/core';
import { ParsedTestResults } from './parse-results';
import { promises as fs } from 'fs';
import * as path from 'path';
import { marked } from 'marked';

export interface ReportData {
  title: string;
  summary: ParsedTestResults['summary'];
  suites: ParsedTestResults['suites'];
  metadata: {
    repository: string;
    branch: string;
    commitSha: string;
    commitAuthor: string;
    actionUrl: string;
    timestamp: string;
  };
  markdown: string;
  html: string;
}

/**
 * Generate test reports in Markdown and HTML formats
 */
export async function generateReport(
  parsedResults: ParsedTestResults,
  title: string = 'Test Results Report'
): Promise<ReportData> {
  core.info('📝 Generating test report...');

  // Get GitHub context information
  const metadata = getGitHubMetadata();

  // Prepare template data
  const templateData = {
    title,
    ...parsedResults.summary,
    isPassed: parsedResults.summary.status === 'passed',
    duration: formatDuration(parsedResults.summary.duration),
    suites: parsedResults.suites.map(suite => ({
      ...suite,
      passed: suite.tests - suite.failures - suite.errors - suite.skipped,
      time: Math.round(suite.time)
    })),
    hasFailures: parsedResults.summary.failed > 0 || parsedResults.summary.errors > 0,
    failedTests: getFailedTests(parsedResults.suites),
    ...metadata
  };

  // Generate Markdown report
  const markdown = await generateMarkdownReport(templateData);
  
  // Generate HTML report
  const html = await generateHtmlReport(templateData, markdown);

  core.info(`✅ Generated report: ${parsedResults.summary.total} tests, ${parsedResults.summary.passed} passed`);

  return {
    title,
    summary: parsedResults.summary,
    suites: parsedResults.suites,
    metadata,
    markdown,
    html
  };
}

/**
 * Generate Markdown report
 */
async function generateMarkdownReport(data: any): Promise<string> {
  const statusIcon = data.isPassed ? '✅' : '❌';
  const statusText = data.isPassed ? 'PASSED' : 'FAILED';

  let markdown = `# ${statusIcon} ${data.title}\n\n`;
  
  markdown += `**Repository:** ${data.repository}  \n`;
  markdown += `**Branch:** ${data.branch}  \n`;
  markdown += `**Status:** ${statusText}  \n`;
  markdown += `**Duration:** ${data.duration}  \n`;
  markdown += `**Timestamp:** ${data.timestamp}  \n\n`;

  // Summary section
  markdown += `## 📊 Summary\n\n`;
  markdown += `| Metric | Count | Percentage |\n`;
  markdown += `|--------|-------|------------|\n`;
  markdown += `| Total Tests | ${data.total} | 100% |\n`;
  markdown += `| ✅ Passed | ${data.passed} | ${Math.round((data.passed / data.total) * 100) || 0}% |\n`;
  
  if (data.failed > 0) {
    markdown += `| ❌ Failed | ${data.failed} | ${Math.round((data.failed / data.total) * 100)}% |\n`;
  }
  
  if (data.skipped > 0) {
    markdown += `| ⚠️ Skipped | ${data.skipped} | ${Math.round((data.skipped / data.total) * 100)}% |\n`;
  }
  
  markdown += `\n`;

  // Test suites section
  if (data.suites && data.suites.length > 0) {
    markdown += `## 📋 Test Suites\n\n`;
    
    for (const suite of data.suites) {
      const suiteIcon = suite.failures === 0 && suite.errors === 0 ? '✅' : '❌';
      markdown += `### ${suiteIcon} ${suite.name}\n\n`;
      markdown += `- **Tests:** ${suite.tests}\n`;
      markdown += `- **Passed:** ${suite.passed}\n`;
      
      if (suite.failures > 0) {
        markdown += `- **Failed:** ${suite.failures}\n`;
      }
      
      if (suite.skipped > 0) {
        markdown += `- **Skipped:** ${suite.skipped}\n`;
      }
      
      markdown += `- **Duration:** ${suite.time}s\n\n`;
    }
  }

  // Failed tests section
  if (data.hasFailures && data.failedTests.length > 0) {
    markdown += `## ❌ Failed Tests\n\n`;
    
    for (const test of data.failedTests) {
      markdown += `### ${test.name}\n\n`;
      
      if (test.failure?.message) {
        markdown += `**Error:** ${test.failure.message}\n\n`;
      }
      
      if (test.failure?.stackTrace) {
        markdown += `**Stack Trace:**\n\`\`\`\n${test.failure.stackTrace}\n\`\`\`\n\n`;
      }
    }
  }

  // Footer
  markdown += `---\n\n`;
  markdown += `**View Details:** [GitHub Actions Run](${data.actionUrl})\n\n`;
  markdown += `Generated by QA CI Reporter Action on ${data.timestamp}\n`;

  return markdown;
}

/**
 * Generate HTML report from Markdown
 */
async function generateHtmlReport(data: any, markdown: string): Promise<string> {
  // Convert markdown to HTML
  const contentHtml = marked(markdown);

  // Try to load custom template, fall back to simple HTML
  let template: string;
  
  try {
    template = await fs.readFile(path.join(__dirname, '../templates/email.html'), 'utf-8');
    
    // Simple template replacement (in a real implementation, you'd use a proper template engine)
    return template
      .replace(/\{\{title\}\}/g, data.title)
      .replace(/\{\{repository\}\}/g, data.repository)
      .replace(/\{\{branch\}\}/g, data.branch)
      .replace(/\{\{total\}\}/g, data.total.toString())
      .replace(/\{\{passed\}\}/g, data.passed.toString())
      .replace(/\{\{failed\}\}/g, data.failed.toString())
      .replace(/\{\{skipped\}\}/g, data.skipped.toString())
      .replace(/\{\{duration\}\}/g, data.duration)
      .replace(/\{\{timestamp\}\}/g, data.timestamp)
      .replace(/\{\{actionUrl\}\}/g, data.actionUrl)
      .replace(/\{\{commitSha\}\}/g, data.commitSha)
      .replace(/\{\{commitAuthor\}\}/g, data.commitAuthor);
      
  } catch (error) {
    core.warning(`Could not load HTML template, using simple HTML: ${error}`);
    
    // Fallback to simple HTML
    template = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${data.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .status { padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; font-weight: bold; }
        .passed { background-color: #d4edda; color: #155724; }
        .failed { background-color: #f8d7da; color: #721c24; }
        .summary { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
        pre { background-color: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>${data.title}</h1>
    <div class="status ${data.isPassed ? 'passed' : 'failed'}">
        ${data.isPassed ? '✅ All Tests Passed' : '❌ Tests Failed'}
    </div>
    <div class="summary">
        ${contentHtml}
    </div>
</body>
</html>`;
  }

  return template;
}

/**
 * Get GitHub context metadata
 */
function getGitHubMetadata() {
  const github = require('@actions/github');
  const context = github.context;

  return {
    repository: context.payload.repository?.full_name || 'unknown/repository',
    branch: context.ref.replace('refs/heads/', '') || 'unknown',
    commitSha: context.sha.substring(0, 7) || 'unknown',
    commitAuthor: context.payload.head_commit?.author?.name || context.actor || 'unknown',
    actionUrl: `https://github.com/${context.payload.repository?.full_name}/actions/runs/${context.runId}`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Extract failed tests from suites
 */
function getFailedTests(suites: ParsedTestResults['suites']) {
  const failedTests: Array<{
    name: string;
    failure?: { message: string; stackTrace?: string };
  }> = [];

  for (const suite of suites) {
    for (const testCase of suite.testCases) {
      if (testCase.status === 'failed' || testCase.status === 'error') {
        failedTests.push({
          name: testCase.name,
          failure: testCase.failure || testCase.error
        });
      }
    }
  }

  return failedTests;
}

/**
 * Format duration from seconds to human readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
} 