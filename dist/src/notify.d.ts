import { ReportData } from './generate-report';
export interface NotificationConfig {
    channels: string[];
    slack?: {
        webhookUrl: string;
        channel?: string;
    };
    telegram?: {
        botToken: string;
        chatId: string;
    };
    email?: {
        smtpHost: string;
        smtpPort: number;
        username: string;
        password: string;
        from: string;
        to: string[];
    };
}
/**
 * Send notifications to configured channels
 */
export declare function sendNotifications(report: ReportData, notificationChannels: string): Promise<void>;
//# sourceMappingURL=notify.d.ts.map