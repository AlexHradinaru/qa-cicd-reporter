export interface TestRunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    resultsPath?: string;
}
/**
 * Executes the test command and captures the results
 */
export declare function runTests(command: string, resultsPath?: string): Promise<TestRunResult>;
/**
 * Validates that a test command is safe to execute
 */
export declare function validateTestCommand(command: string): boolean;
/**
 * Creates a summary of the test execution for GitHub Actions
 */
export declare function createTestExecutionSummary(result: TestRunResult): void;
//# sourceMappingURL=run-tests.d.ts.map