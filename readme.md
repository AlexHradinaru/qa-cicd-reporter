# QA CI Reporter Action


A GitHub Action that runs test suites (Cypress, Playwright, Jest, etc.), parses results, generates clean reports, and sends notifications via Slack, Telegram, or email.

## 🚀 Features

- **Universal Test Runner**: Supports any test command (`npm test`, `npx cypress run`, `playwright test`, etc.)
- **Multiple Result Formats**: Parses JUnit XML, JSON, and console output
- **Rich Reports**: Generates beautiful Markdown and HTML reports
- **Multi-Channel Notifications**: Send to Slack, Telegram, or email
- **Flexible Configuration**: Customize reports, channels, and behavior
- **GitHub Integration**: Creates action summaries and sets outputs
- **Security**: Validates commands and handles secrets safely

## 📋 Quick Start

```yaml
name: CI Tests with Reporting

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests and report
        uses: your-username/qa-ci-reporter-action@v1
        with:
          test-command: 'npm test'
          notification-channels: 'slack'
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 📝 Inputs

### Required Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `test-command` | Command to run tests | `npm test` |
| `notification-channels` | Notification channels (comma-separated: slack, telegram, email) | `slack` |

### Test Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `test-results-path` | Path to test results file (JUnit XML or JSON) | Auto-detect |
| `report-title` | Title for the test report | `Test Results Report` |
| `include-logs` | Include test logs in the report | `true` |
| `include-screenshots` | Include screenshots in the report | `false` |
| `fail-on-test-failure` | Fail the action if tests fail | `true` |

### Slack Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `slack-webhook-url` | Slack webhook URL | - |
| `slack-channel` | Slack channel to send to | `#ci-reports` |

### Telegram Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `telegram-bot-token` | Telegram bot token | - |
| `telegram-chat-id` | Telegram chat ID | - |

### Email Configuration

| Input | Description | Default |
|-------|-------------|---------|
| `email-smtp-host` | SMTP server host | - |
| `email-smtp-port` | SMTP server port | `587` |
| `email-username` | Email username | - |
| `email-password` | Email password | - |
| `email-from` | Email sender address | - |
| `email-to` | Email recipients (comma-separated) | - |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `test-status` | Overall test status (passed/failed) |
| `total-tests` | Total number of tests run |
| `passed-tests` | Number of tests that passed |
| `failed-tests` | Number of tests that failed |
| `skipped-tests` | Number of tests that were skipped |
| `test-duration` | Total test execution time (seconds) |
| `report-url` | URL to the generated report (if applicable) |

## 📖 Usage Examples

### Basic Cypress Testing

```yaml
- name: Run Cypress tests
  uses: your-username/qa-ci-reporter-action@v1
  with:
    test-command: 'npx cypress run'
    test-results-path: 'cypress/results/output.xml'
    notification-channels: 'slack'
    slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Playwright with Multiple Notifications

```yaml
- name: Run Playwright tests
  uses: your-username/qa-ci-reporter-action@v1
  with:
    test-command: 'npx playwright test'
    test-results-path: 'test-results/results.xml'
    notification-channels: 'slack,email'
    report-title: 'E2E Test Results'
    slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    email-smtp-host: 'smtp.gmail.com'
    email-username: ${{ secrets.EMAIL_USERNAME }}
    email-password: ${{ secrets.EMAIL_PASSWORD }}
    email-from: 'ci@yourcompany.com'
    email-to: 'team@yourcompany.com,qa@yourcompany.com'
```

### Jest with Custom Configuration

```yaml
- name: Run Jest tests
  uses: your-username/qa-ci-reporter-action@v1
  with:
    test-command: 'npm run test:ci'
    notification-channels: 'telegram'
    report-title: 'Unit Test Results - ${{ github.event.head_commit.message }}'
    include-logs: true
    fail-on-test-failure: false
    telegram-bot-token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    telegram-chat-id: ${{ secrets.TELEGRAM_CHAT_ID }}
```

### Multiple Test Suites

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Unit Tests
        uses: your-username/qa-ci-reporter-action@v1
        with:
          test-command: 'npm run test:unit'
          report-title: 'Unit Test Results'
          notification-channels: 'slack'
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: E2E Tests
        uses: your-username/qa-ci-reporter-action@v1
        with:
          test-command: 'npm run test:e2e'
          report-title: 'E2E Test Results'
          notification-channels: 'slack'
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 🔧 Setup Instructions

### 1. Slack Setup

1. Create a Slack webhook:
   - Go to https://api.slack.com/apps
   - Create a new app → "From scratch"
   - Add "Incoming Webhooks" feature
   - Create a webhook for your channel
2. Add the webhook URL to GitHub Secrets as `SLACK_WEBHOOK_URL`

### 2. Telegram Setup

1. Create a Telegram bot:
   - Message @BotFather on Telegram
   - Use `/newbot` command
   - Get your bot token
2. Get your chat ID:
   - Add the bot to your group/channel
   - Send a message to the bot
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find your chat ID in the response
3. Add to GitHub Secrets:
   - `TELEGRAM_BOT_TOKEN`: Your bot token
   - `TELEGRAM_CHAT_ID`: Your chat ID

### 3. Email Setup

1. Get SMTP credentials from your email provider
2. Add to GitHub Secrets:
   - `EMAIL_USERNAME`: Your email username
   - `EMAIL_PASSWORD`: Your email password (or app password)

## 🎨 Report Examples

### Slack Report
```
🧪 Test Results Report - Main Branch

✅ Status: PASSED
📊 Results: 45 passed, 0 failed, 2 skipped
⏱️ Duration: 2m 34s
🔗 View Details: https://github.com/user/repo/actions/runs/123

📋 Test Suites:
✅ Unit Tests: 32/32 passed
✅ Integration Tests: 13/13 passed
⚠️ E2E Tests: 0/2 skipped
```

### Email Report
- Clean HTML formatting
- Detailed test breakdowns
- Failure details and stack traces
- Screenshots (if enabled)
- Links to GitHub Actions run

## ⚙️ Supported Test Frameworks

- **Jest** - JavaScript testing
- **Cypress** - E2E testing
- **Playwright** - Cross-browser testing
- **Mocha** - JavaScript testing
- **PHPUnit** - PHP testing
- **PyTest** - Python testing
- **Any framework** that outputs JUnit XML or structured JSON

## 🔍 Troubleshooting

### Common Issues

1. **No test results found**
   - Ensure your test command generates results
   - Check the `test-results-path` input
   - Verify file permissions

2. **Slack notifications not working**
   - Verify webhook URL in secrets
   - Check channel permissions
   - Test webhook manually

3. **Email notifications failing**
   - Verify SMTP settings
   - Check if using app passwords (Gmail, etc.)
   - Ensure less secure apps enabled (if required)

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Marketplace](https://github.com/marketplace)
- [Issue Tracker](https://github.com/your-username/qa-ci-reporter-action/issues)
- [Changelog](CHANGELOG.md)
