import * as core from '@actions/core';
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
export async function sendNotifications(
  report: ReportData,
  notificationChannels: string
): Promise<void> {
  core.info('📢 Sending notifications...');

  const channels = notificationChannels.split(',').map(c => c.trim().toLowerCase());
  const config = buildNotificationConfig(channels);

  const results: Array<{ channel: string; success: boolean; error?: string }> = [];

  for (const channel of channels) {
    try {
      switch (channel) {
        case 'slack':
          if (config.slack) {
            await sendSlackNotification(report, config.slack);
            results.push({ channel: 'slack', success: true });
            core.info('✅ Slack notification sent successfully');
          } else {
            throw new Error('Slack configuration missing');
          }
          break;

        case 'telegram':
          if (config.telegram) {
            await sendTelegramNotification(report, config.telegram);
            results.push({ channel: 'telegram', success: true });
            core.info('✅ Telegram notification sent successfully');
          } else {
            throw new Error('Telegram configuration missing');
          }
          break;

        case 'email':
          if (config.email) {
            await sendEmailNotification(report, config.email);
            results.push({ channel: 'email', success: true });
            core.info('✅ Email notification sent successfully');
          } else {
            throw new Error('Email configuration missing');
          }
          break;

        case 'console':
          // For local testing - just log to console
          core.info('📊 Console notification:');
          console.log(generateSlackMessage(report));
          results.push({ channel: 'console', success: true });
          core.info('✅ Console notification sent successfully');
          break;

        default:
          core.warning(`⚠️ Unknown notification channel: ${channel}`);
          results.push({ 
            channel, 
            success: false, 
            error: `Unknown channel: ${channel}` 
          });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      core.error(`❌ Failed to send ${channel} notification: ${errorMessage}`);
      results.push({ 
        channel, 
        success: false, 
        error: errorMessage 
      });
    }
  }

  // Log summary
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  if (successful === total) {
    core.info(`✅ All notifications sent successfully (${successful}/${total})`);
  } else {
    core.warning(`⚠️ Some notifications failed (${successful}/${total} successful)`);
  }
}

/**
 * Build notification configuration from inputs
 */
function buildNotificationConfig(channels: string[]): NotificationConfig {
  const config: NotificationConfig = { channels };

  // Slack configuration
  if (channels.includes('slack')) {
    const webhookUrl = core.getInput('slack-webhook-url');
    if (webhookUrl) {
      config.slack = {
        webhookUrl,
        channel: core.getInput('slack-channel') || '#ci-reports'
      };
    }
  }

  // Telegram configuration
  if (channels.includes('telegram')) {
    const botToken = core.getInput('telegram-bot-token');
    const chatId = core.getInput('telegram-chat-id');
    if (botToken && chatId) {
      config.telegram = {
        botToken,
        chatId
      };
    }
  }

  // Email configuration
  if (channels.includes('email')) {
    const smtpHost = core.getInput('email-smtp-host');
    const username = core.getInput('email-username');
    const password = core.getInput('email-password');
    const from = core.getInput('email-from');
    const to = core.getInput('email-to');

    if (smtpHost && username && password && from && to) {
      config.email = {
        smtpHost,
        smtpPort: parseInt(core.getInput('email-smtp-port') || '587'),
        username,
        password,
        from,
        to: to.split(',').map(email => email.trim())
      };
    }
  }

  return config;
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(
  report: ReportData,
  config: NonNullable<NotificationConfig['slack']>
): Promise<void> {
  // Use fetch for webhook approach instead of WebClient
  const message = generateSlackMessage(report);

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
      channel: config.channel,
      username: 'QA CI Reporter',
      icon_emoji: report.summary.status === 'passed' ? ':white_check_mark:' : ':x:'
    })
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
  }
}

/**
 * Generate Slack message from report
 */
function generateSlackMessage(report: ReportData): string {
  const statusIcon = report.summary.status === 'passed' ? '✅' : '❌';
  const statusText = report.summary.status === 'passed' ? 'PASSED' : 'FAILED';

  let message = `🧪 *${report.title}* - ${report.metadata.branch}\n\n`;
  message += `${statusIcon} *Status: ${statusText}*\n`;
  message += `📊 *Results:* ${report.summary.passed} passed`;
  
  if (report.summary.failed > 0) {
    message += `, ${report.summary.failed} failed`;
  }
  
  if (report.summary.skipped > 0) {
    message += `, ${report.summary.skipped} skipped`;
  }
  
  message += `\n⏱️ *Duration:* ${formatDuration(report.summary.duration)}\n`;
  message += `🔗 *View Details:* ${report.metadata.actionUrl}\n`;

  if (report.suites.length > 0) {
    message += `\n📋 *Test Suites:*\n`;
    for (const suite of report.suites) {
      const suiteIcon = suite.failures === 0 && suite.errors === 0 ? '✅' : '❌';
      const passed = suite.tests - suite.failures - suite.errors - suite.skipped;
      message += `${suiteIcon} ${suite.name}: ${passed}/${suite.tests} passed`;
      
      if (suite.failures > 0) {
        message += `, ${suite.failures} failed`;
      }
      
      message += `\n`;
    }
  }

  return message;
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(
  report: ReportData,
  config: NonNullable<NotificationConfig['telegram']>
): Promise<void> {
  const message = generateTelegramMessage(report);
  
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const errorData = await response.json() as any;
    throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
  }
}

/**
 * Generate Telegram message from report
 */
function generateTelegramMessage(report: ReportData): string {
  const statusIcon = report.summary.status === 'passed' ? '✅' : '❌';
  const statusText = report.summary.status === 'passed' ? 'PASSED' : 'FAILED';

  let message = `🧪 *${report.title}* - ${report.metadata.branch}\n\n`;
  message += `${statusIcon} *Status: ${statusText}*\n`;
  message += `📊 *Results:* ${report.summary.passed} passed`;
  
  if (report.summary.failed > 0) {
    message += `, ${report.summary.failed} failed`;
  }
  
  if (report.summary.skipped > 0) {
    message += `, ${report.summary.skipped} skipped`;
  }
  
  message += `\n⏱️ *Duration:* ${formatDuration(report.summary.duration)}\n`;
  message += `🔗 [View Details](${report.metadata.actionUrl})\n`;

  if (report.suites.length > 0 && report.suites.length <= 5) {
    message += `\n📋 *Test Suites:*\n`;
    for (const suite of report.suites) {
      const suiteIcon = suite.failures === 0 && suite.errors === 0 ? '✅' : '❌';
      const passed = suite.tests - suite.failures - suite.errors - suite.skipped;
      message += `${suiteIcon} ${suite.name}: ${passed}/${suite.tests} passed\n`;
    }
  }

  return message;
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  report: ReportData,
  config: NonNullable<NotificationConfig['email']>
): Promise<void> {
  const nodemailer = require('nodemailer');

  // Create transporter
  const transporter = nodemailer.createTransporter({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  // Generate email content
  const subject = `${report.summary.status === 'passed' ? '✅' : '❌'} ${report.title} - ${report.metadata.repository}`;
  
  // Send email
  const info = await transporter.sendMail({
    from: config.from,
    to: config.to.join(', '),
    subject,
    text: report.markdown, // Plain text version
    html: report.html,     // HTML version
  });

  core.debug(`Email sent: ${info.messageId}`);
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