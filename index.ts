import * as core from '@actions/core';
import { runTests, validateTestCommand } from './src/run-tests';
import { parseTestResults } from './src/parse-results';
import { generateReport } from './src/generate-report';
import { sendNotifications } from './src/notify';

/**
 * Main function that orchestrates the GitHub Action
 */
async function run(): Promise<void> {
  try {
    core.info('🚀 Starting QA CI Reporter Action');

    // Get inputs from action.yml
    const testCommand = core.getInput('test-command', { required: true });
    const testResultsPath = core.getInput('test-results-path');
    const reportTitle = core.getInput('report-title');
    const notificationChannels = core.getInput('notification-channels', { required: true });
    const failOnTestFailure = core.getBooleanInput('fail-on-test-failure');

    core.info(`📝 Test command: ${testCommand}`);
    core.info(`📄 Results path: ${testResultsPath || 'Auto-detect'}`);
    core.info(`📢 Notification channels: ${notificationChannels}`);

    // Step 1: Validate test command for security
    validateTestCommand(testCommand);

    // Step 2: Run tests
    core.startGroup('🧪 Running Tests');
    const testResult = await runTests(testCommand, testResultsPath);
    core.endGroup();

    // Step 3: Parse test results
    core.startGroup('📊 Parsing Test Results');
    const parsedResults = await parseTestResults(testResult);
    core.endGroup();

    // Step 4: Generate reports
    core.startGroup('📝 Generating Reports');
    const report = await generateReport(parsedResults, reportTitle);
    core.endGroup();

    // Step 5: Send notifications
    core.startGroup('📢 Sending Notifications');
    await sendNotifications(report, notificationChannels);
    core.endGroup();

    // Step 6: Create GitHub Action summary
    core.startGroup('📋 Creating Action Summary');
    await core.summary
      .addHeading(`${report.summary.status === 'passed' ? '✅' : '❌'} ${report.title}`, 1)
      .addTable([
        [
          { data: 'Total Tests', header: true },
          { data: 'Passed', header: true },
          { data: 'Failed', header: true },
          { data: 'Skipped', header: true },
          { data: 'Duration', header: true }
        ],
        [
          report.summary.total.toString(),
          report.summary.passed.toString(),
          report.summary.failed.toString(),
          report.summary.skipped.toString(),
          `${report.summary.duration}s`
        ]
      ])
      .addRaw(report.markdown)
      .write();
    core.endGroup();

    // Step 7: Set outputs
    core.setOutput('test-status', report.summary.status);
    core.setOutput('total-tests', report.summary.total.toString());
    core.setOutput('passed-tests', report.summary.passed.toString());
    core.setOutput('failed-tests', report.summary.failed.toString());
    core.setOutput('skipped-tests', report.summary.skipped.toString());
    core.setOutput('test-duration', report.summary.duration.toString());
    core.setOutput('report-markdown', report.markdown);
    core.setOutput('report-html', report.html);

    // Step 8: Handle test failures
    if (report.summary.status === 'failed' && failOnTestFailure) {
      core.setFailed(`Tests failed: ${report.summary.failed} test(s) failed`);
    } else {
      core.info(`✅ QA CI Reporter completed successfully`);
      core.info(`📊 Results: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`QA CI Reporter failed: ${errorMessage}`);
    
    // Try to create a basic error summary
    try {
      await core.summary
        .addHeading('❌ QA CI Reporter Failed', 1)
        .addCodeBlock(errorMessage, 'text')
        .write();
    } catch (summaryError) {
      core.warning(`Could not create error summary: ${summaryError}`);
    }
  }
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  core.error(`Unhandled promise rejection at ${promise}: ${reason}`);
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  core.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the action
if (require.main === module) {
  run();
} 