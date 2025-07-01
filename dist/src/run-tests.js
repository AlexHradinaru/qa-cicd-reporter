"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
exports.validateTestCommand = validateTestCommand;
exports.createTestExecutionSummary = createTestExecutionSummary;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
/**
 * Executes the test command and captures the results
 */
async function runTests(command, resultsPath) {
    core.info(`🚀 Running tests with command: ${command}`);
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    const options = {
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            }
        },
        ignoreReturnCode: true // Don't throw on non-zero exit codes
    };
    try {
        // Split command into parts for proper execution
        const commandParts = command.split(' ');
        const mainCommand = commandParts[0];
        const args = commandParts.slice(1);
        core.info(`Executing: ${mainCommand} with args: ${args.join(' ')}`);
        exitCode = await exec.exec(mainCommand, args, options);
        const duration = Date.now() - startTime;
        const durationSeconds = Math.round(duration / 1000);
        core.info(`✅ Test execution completed in ${durationSeconds}s`);
        core.info(`Exit code: ${exitCode}`);
        // Try to find test results file if not explicitly provided
        let finalResultsPath = resultsPath;
        if (!finalResultsPath) {
            finalResultsPath = await findTestResultsFile();
        }
        // Verify results file exists
        if (finalResultsPath) {
            try {
                await fs_1.promises.access(finalResultsPath);
                core.info(`📄 Test results found at: ${finalResultsPath}`);
            }
            catch (error) {
                core.warning(`⚠️ Test results file not found at: ${finalResultsPath}`);
                finalResultsPath = undefined;
            }
        }
        return {
            exitCode,
            stdout,
            stderr,
            duration: durationSeconds,
            resultsPath: finalResultsPath
        };
    }
    catch (error) {
        core.error(`❌ Failed to run tests: ${error}`);
        return {
            exitCode: 1,
            stdout,
            stderr: stderr + `\nError: ${error}`,
            duration: Math.round((Date.now() - startTime) / 1000),
            resultsPath: undefined
        };
    }
}
/**
 * Attempts to find common test result files
 */
async function findTestResultsFile() {
    const commonPaths = [
        // JUnit XML files
        'test-results.xml',
        'junit.xml',
        'test-output.xml',
        'cypress/results/output.xml',
        'test-results/junit.xml',
        'reports/junit.xml',
        // JSON result files
        'test-results.json',
        'cypress/results/output.json',
        'playwright-report/results.json',
        'test-results/results.json',
        // Cypress specific
        'cypress/results/mochawesome.json',
        'mochawesome-report/mochawesome.json',
        // Playwright specific
        'test-results/results.xml',
        'playwright-report/results.xml'
    ];
    for (const filePath of commonPaths) {
        try {
            await fs_1.promises.access(filePath);
            core.info(`🔍 Found test results file: ${filePath}`);
            return filePath;
        }
        catch {
            // File doesn't exist, continue searching
        }
    }
    // Try to find any XML or JSON files in common directories
    const searchDirs = ['test-results', 'cypress/results', 'playwright-report', 'reports'];
    for (const dir of searchDirs) {
        try {
            const files = await fs_1.promises.readdir(dir);
            const resultFile = files.find(file => file.endsWith('.xml') || file.endsWith('.json'));
            if (resultFile) {
                const fullPath = path.join(dir, resultFile);
                core.info(`🔍 Found test results file: ${fullPath}`);
                return fullPath;
            }
        }
        catch {
            // Directory doesn't exist, continue searching
        }
    }
    core.warning('⚠️ No test results file found. Will parse from stdout/stderr.');
    return undefined;
}
/**
 * Validates that a test command is safe to execute
 */
function validateTestCommand(command) {
    // Basic validation to prevent malicious commands
    const dangerousPatterns = [
        /rm\s+-rf/,
        /sudo/,
        /curl.*\|.*sh/,
        /wget.*\|.*sh/,
        /eval/,
        /exec/,
        />/, // Redirection
        /&&.*rm/,
        /;.*rm/
    ];
    const isDangerous = dangerousPatterns.some(pattern => pattern.test(command));
    if (isDangerous) {
        core.error(`❌ Command appears to be dangerous: ${command}`);
        return false;
    }
    return true;
}
/**
 * Creates a summary of the test execution for GitHub Actions
 */
function createTestExecutionSummary(result) {
    const status = result.exitCode === 0 ? '✅ PASSED' : '❌ FAILED';
    const duration = `${result.duration}s`;
    core.summary.addHeading('🧪 Test Execution Summary');
    core.summary.addTable([
        [
            { data: 'Status', header: true },
            { data: 'Duration', header: true },
            { data: 'Exit Code', header: true },
            { data: 'Results File', header: true }
        ],
        [
            status,
            duration,
            result.exitCode.toString(),
            result.resultsPath || 'Not found'
        ]
    ]);
    if (result.stdout) {
        core.summary.addDetails('📝 Test Output', `\`\`\`\n${result.stdout.slice(-2000)}\n\`\`\``);
    }
    if (result.stderr && result.exitCode !== 0) {
        core.summary.addDetails('⚠️ Error Output', `\`\`\`\n${result.stderr.slice(-1000)}\n\`\`\``);
    }
    core.summary.write();
}
//# sourceMappingURL=run-tests.js.map