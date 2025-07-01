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
export declare function parseTestResults(testResult: TestRunResult): Promise<ParsedTestResults>;
//# sourceMappingURL=parse-results.d.ts.map