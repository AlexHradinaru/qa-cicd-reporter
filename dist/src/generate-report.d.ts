import { ParsedTestResults } from './parse-results';
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
export declare function generateReport(parsedResults: ParsedTestResults, title?: string): Promise<ReportData>;
//# sourceMappingURL=generate-report.d.ts.map