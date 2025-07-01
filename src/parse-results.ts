import * as core from '@actions/core';
import { promises as fs } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { TestRunResult } from './run-tests';

export interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testCases: TestCase[];
}

export interface TestCase {
  name: string;
  classname?: string;
  time: number;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  failure?: {
    message: string;
    type: string;
    stackTrace?: string;
  };
  error?: {
    message: string;
    type: string;
    stackTrace?: string;
  };
  systemOut?: string;
  systemErr?: string;
}

export interface ParsedTestResults {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    duration: number;
    status: 'passed' | 'failed';
  };
  suites: TestSuite[];
  rawOutput?: string;
  rawError?: string;
}

/**
 * Main function to parse test results from various formats
 */
export async function parseTestResults(testResult: TestRunResult): Promise<ParsedTestResults> {
  core.info('📊 Parsing test results...');

  let parsedResults: ParsedTestResults;

  // If we have a results file, parse it
  if (testResult.resultsPath) {
    try {
      const fileContent = await fs.readFile(testResult.resultsPath, 'utf-8');
      const fileExtension = testResult.resultsPath.toLowerCase();

      if (fileExtension.endsWith('.xml')) {
        parsedResults = await parseJUnitXML(fileContent);
      } else if (fileExtension.endsWith('.json')) {
        parsedResults = await parseJSONResults(fileContent);
      } else {
        core.warning(`⚠️ Unsupported file format: ${testResult.resultsPath}`);
        parsedResults = parseFromOutput(testResult.stdout, testResult.stderr);
      }
    } catch (error) {
      core.warning(`⚠️ Failed to parse results file: ${error}`);
      parsedResults = parseFromOutput(testResult.stdout, testResult.stderr);
    }
  } else {
    // Fall back to parsing stdout/stderr
    parsedResults = parseFromOutput(testResult.stdout, testResult.stderr);
  }

  // Add raw output for debugging
  parsedResults.rawOutput = testResult.stdout;
  parsedResults.rawError = testResult.stderr;

  // Log summary
  const { summary } = parsedResults;
  core.info(`📊 Test Summary: ${summary.total} total, ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`);

  // Set action outputs
  core.setOutput('total-tests', summary.total.toString());
  core.setOutput('passed-tests', summary.passed.toString());
  core.setOutput('failed-tests', summary.failed.toString());
  core.setOutput('skipped-tests', summary.skipped.toString());

  return parsedResults;
}

/**
 * Parse JUnit XML format results
 */
async function parseJUnitXML(xmlContent: string): Promise<ParsedTestResults> {
  core.info('🔍 Parsing JUnit XML results...');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  });

  try {
    const result = parser.parse(xmlContent);
    const suites: TestSuite[] = [];

    // Handle different XML structures
    let testSuites: any[] = [];
    
    if (result.testsuites) {
      // Multiple test suites
      if (Array.isArray(result.testsuites.testsuite)) {
        testSuites = result.testsuites.testsuite;
      } else {
        testSuites = [result.testsuites.testsuite];
      }
    } else if (result.testsuite) {
      // Single test suite
      testSuites = Array.isArray(result.testsuite) ? result.testsuite : [result.testsuite];
    }

    for (const suite of testSuites) {
      if (!suite) continue;

      const testCases: TestCase[] = [];
      let suiteCases = suite.testcase || [];
      
      if (!Array.isArray(suiteCases)) {
        suiteCases = [suiteCases];
      }

      for (const testCase of suiteCases) {
        if (!testCase) continue;

        const test: TestCase = {
          name: testCase['@_name'] || 'Unknown Test',
          classname: testCase['@_classname'],
          time: parseFloat(testCase['@_time'] || '0'),
          status: 'passed' // default
        };

        // Check for failures
        if (testCase.failure) {
          test.status = 'failed';
          test.failure = {
            message: testCase.failure['@_message'] || testCase.failure['#text'] || 'Test failed',
            type: testCase.failure['@_type'] || 'AssertionError',
            stackTrace: testCase.failure['#text']
          };
        }

        // Check for errors
        if (testCase.error) {
          test.status = 'error';
          test.error = {
            message: testCase.error['@_message'] || testCase.error['#text'] || 'Test error',
            type: testCase.error['@_type'] || 'Error',
            stackTrace: testCase.error['#text']
          };
        }

        // Check for skipped
        if (testCase.skipped) {
          test.status = 'skipped';
        }

        // Add system output
        if (testCase['system-out']) {
          test.systemOut = testCase['system-out']['#text'] || testCase['system-out'];
        }

        if (testCase['system-err']) {
          test.systemErr = testCase['system-err']['#text'] || testCase['system-err'];
        }

        testCases.push(test);
      }

      const testSuite: TestSuite = {
        name: suite['@_name'] || 'Unknown Suite',
        tests: parseInt(suite['@_tests'] || '0'),
        failures: parseInt(suite['@_failures'] || '0'),
        errors: parseInt(suite['@_errors'] || '0'),
        skipped: parseInt(suite['@_skipped'] || '0'),
        time: parseFloat(suite['@_time'] || '0'),
        testCases
      };

      suites.push(testSuite);
    }

    // Calculate summary
    const summary = calculateSummary(suites);

    return { summary, suites };

  } catch (error) {
    core.error(`❌ Failed to parse JUnit XML: ${error}`);
    throw error;
  }
}

/**
 * Parse JSON format results (Cypress, Playwright, etc.)
 */
async function parseJSONResults(jsonContent: string): Promise<ParsedTestResults> {
  core.info('🔍 Parsing JSON results...');

  try {
    const data = JSON.parse(jsonContent);

    // Handle different JSON structures
    if (data.suites || data.tests) {
      // Mocha/Cypress format
      return parseMochaJSON(data);
    } else if (data.stats && data.results) {
      // Playwright format
      return parsePlaywrightJSON(data);
    } else {
      // Generic format - try to extract what we can
      return parseGenericJSON(data);
    }

  } catch (error) {
    core.error(`❌ Failed to parse JSON results: ${error}`);
    throw error;
  }
}

/**
 * Parse Mocha/Cypress JSON format
 */
function parseMochaJSON(data: any): ParsedTestResults {
  const suites: TestSuite[] = [];

  function processSuite(suite: any): TestSuite {
    const testCases: TestCase[] = [];

    if (suite.tests) {
      for (const test of suite.tests) {
        const testCase: TestCase = {
          name: test.title || test.name || 'Unknown Test',
          time: (test.duration || 0) / 1000, // Convert ms to seconds
          status: test.state || (test.pass ? 'passed' : test.pending ? 'skipped' : 'failed')
        };

        if (test.err || test.error) {
          const error = test.err || test.error;
          testCase.failure = {
            message: error.message || 'Test failed',
            type: error.name || 'Error',
            stackTrace: error.stack
          };
        }

        testCases.push(testCase);
      }
    }

    // Process nested suites
    if (suite.suites) {
      for (const nestedSuite of suite.suites) {
        const nested = processSuite(nestedSuite);
        testCases.push(...nested.testCases);
      }
    }

    return {
      name: suite.title || suite.name || 'Unknown Suite',
      tests: testCases.length,
      failures: testCases.filter(t => t.status === 'failed').length,
      errors: testCases.filter(t => t.status === 'error').length,
      skipped: testCases.filter(t => t.status === 'skipped').length,
      time: testCases.reduce((sum, t) => sum + t.time, 0),
      testCases
    };
  }

  if (data.suites) {
    for (const suite of data.suites) {
      suites.push(processSuite(suite));
    }
  } else {
    // Single suite
    suites.push(processSuite(data));
  }

  const summary = calculateSummary(suites);
  return { summary, suites };
}

/**
 * Parse Playwright JSON format
 */
function parsePlaywrightJSON(data: any): ParsedTestResults {
  const suites: TestSuite[] = [];
  const testCases: TestCase[] = [];

  if (data.suites) {
    for (const suite of data.suites) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const testCase: TestCase = {
            name: test.title,
            time: (test.results?.[0]?.duration || 0) / 1000,
            status: test.outcome || 'unknown'
          };

          if (test.results?.[0]?.error) {
            testCase.failure = {
              message: test.results[0].error.message || 'Test failed',
              type: 'Error',
              stackTrace: test.results[0].error.stack
            };
          }

          testCases.push(testCase);
        }
      }
    }
  }

  const suite: TestSuite = {
    name: 'Playwright Tests',
    tests: testCases.length,
    failures: testCases.filter(t => t.status === 'failed').length,
    errors: testCases.filter(t => t.status === 'error').length,
    skipped: testCases.filter(t => t.status === 'skipped').length,
    time: testCases.reduce((sum, t) => sum + t.time, 0),
    testCases
  };

  suites.push(suite);
  const summary = calculateSummary(suites);
  return { summary, suites };
}

/**
 * Parse generic JSON format
 */
function parseGenericJSON(data: any): ParsedTestResults {
  // This is a fallback for unknown JSON formats
  const suite: TestSuite = {
    name: 'Test Results',
    tests: data.total || 0,
    failures: data.failures || data.failed || 0,
    errors: data.errors || 0,
    skipped: data.skipped || data.pending || 0,
    time: data.duration || data.time || 0,
    testCases: []
  };

  const summary = calculateSummary([suite]);
  return { summary, suites: [suite] };
}

/**
 * Parse test results from stdout/stderr when no results file is available
 */
function parseFromOutput(stdout: string, stderr: string): ParsedTestResults {
  core.info('🔍 Parsing test results from output...');

  // Try to extract common test patterns
  const output = stdout + '\n' + stderr;
  
  // Jest pattern - supports multiple formats
  const jestMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,(?:\s+(\d+)\s+skipped,)?\s+(\d+)\s+total/) ||
                   output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    return parseJestOutput(output, jestMatch);
  }

  // Mocha pattern
  const mochaMatch = output.match(/(\d+)\s+passing\s*(?:\(.*?\))?\s*(?:(\d+)\s+failing)?(?:\s*(\d+)\s+pending)?/);
  if (mochaMatch) {
    return parseMochaOutput(output, mochaMatch);
  }

  // Cypress pattern
  const cypressMatch = output.match(/(\d+)\s+passing.*?(\d+)\s+failing/);
  if (cypressMatch) {
    return parseCypressOutput(output, cypressMatch);
  }

  // Generic pattern - look for numbers
  const genericMatch = output.match(/(\d+).*?test.*?(pass|fail)/i);
  if (genericMatch) {
    return parseGenericOutput(output);
  }

  // Fallback - no specific pattern found
  core.warning('⚠️ Could not parse test results from output');
  
  const suite: TestSuite = {
    name: 'Unknown Tests',
    tests: 0,
    failures: 0,
    errors: 0,
    skipped: 0,
    time: 0,
    testCases: []
  };

  const summary = calculateSummary([suite]);
  return { summary, suites: [suite] };
}

function parseJestOutput(_output: string, match: RegExpMatchArray): ParsedTestResults {
  const failed = parseInt(match[1]);
  // match[2] is passed count but we calculate it from total for consistency
  const skipped = match[3] ? parseInt(match[3]) : 0; // skipped might not be present
  const total = parseInt(match[4] || match[3]); // total is in different position depending on format

  const suite: TestSuite = {
    name: 'Jest Tests',
    tests: total,
    failures: failed,
    errors: 0,
    skipped: skipped,
    time: 0,
    testCases: []
  };

  const summary = calculateSummary([suite]);
  return { summary, suites: [suite] };
}

function parseMochaOutput(_output: string, match: RegExpMatchArray): ParsedTestResults {
  const passed = parseInt(match[1]);
  const failed = parseInt(match[2] || '0');
  const pending = parseInt(match[3] || '0');

  const suite: TestSuite = {
    name: 'Mocha Tests',
    tests: passed + failed + pending,
    failures: failed,
    errors: 0,
    skipped: pending,
    time: 0,
    testCases: []
  };

  const summary = calculateSummary([suite]);
  return { summary, suites: [suite] };
}

function parseCypressOutput(_output: string, match: RegExpMatchArray): ParsedTestResults {
  const passed = parseInt(match[1]);
  const failed = parseInt(match[2]);

  const suite: TestSuite = {
    name: 'Cypress Tests',
    tests: passed + failed,
    failures: failed,
    errors: 0,
    skipped: 0,
    time: 0,
    testCases: []
  };

  const summary = calculateSummary([suite]);
  return { summary, suites: [suite] };
}

function parseGenericOutput(output: string): ParsedTestResults {
  // Try to extract any numbers we can find
  const numbers = output.match(/\d+/g) || [];
  const total = numbers.length > 0 ? parseInt(numbers[0] || '0') : 0;

  const suite: TestSuite = {
    name: 'Generic Tests',
    tests: total,
    failures: 0,
    errors: 0,
    skipped: 0,
    time: 0,
    testCases: []
  };

  const summary = calculateSummary([suite]);
  return { summary, suites: [suite] };
}

/**
 * Calculate summary statistics from test suites
 */
function calculateSummary(suites: TestSuite[]): ParsedTestResults['summary'] {
  const summary: ParsedTestResults['summary'] = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    duration: 0,
    status: 'passed'
  };

  for (const suite of suites) {
    summary.total += suite.tests;
    summary.failed += suite.failures;
    summary.errors += suite.errors;
    summary.skipped += suite.skipped;
    summary.duration += suite.time;
  }

  summary.passed = summary.total - summary.failed - summary.errors - summary.skipped;
  summary.status = (summary.failed > 0 || summary.errors > 0) ? 'failed' : 'passed';

  return summary;
} 