# Telegram Bot Setup Guide

## Prerequisites

1. You already have a Telegram bot and bot token
2. The bot token is stored in Parameter Store: `/DanfossAlertsStack/telegram-bot-token`

## Step 1: Deploy the Stack

Deploy the updated stack to create the API Gateway and Lambda function:

```bash
npm run deploy
```

After deployment, note the **TelegramWebhookUrl** from the CDK outputs.

## Step 2: Get Your Webhook URL

After deployment, you'll see an output like:

```
✅  DanfossAlertsStack

Outputs:
DanfossAlertsStack.TelegramWebhookUrl = https://abc123xyz.execute-api.eu-west-1.amazonaws.com/prod/webhook
```

Copy this URL - you'll need it in the next step.

Alternatively, you can find it in AWS Console:
- Go to **CloudFormation** → Your stack → **Outputs** tab
- Look for `TelegramWebhookUrl`

## Step 3: Set the Webhook URL in Telegram

Set the webhook URL using one of these methods:

### Option A: Using curl (Terminal)

```bash
# Replace <YOUR_BOT_TOKEN> with your actual bot token
# Replace <WEBHOOK_URL> with the URL from Step 2

curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<WEBHOOK_URL>"}'
```

**Example:**
```bash
curl -X POST "https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://abc123xyz.execute-api.eu-west-1.amazonaws.com/prod/webhook"}'
```

### Option B: Using Browser

Open this URL in your browser (replace the placeholders):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<WEBHOOK_URL>
```

**Example:**
```
https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://abc123xyz.execute-api.eu-west-1.amazonaws.com/prod/webhook
```

### Option C: Using AWS CLI (if you have bot token in Parameter Store)

```bash
# Get bot token from Parameter Store
BOT_TOKEN=$(aws ssm get-parameter \
  --name /DanfossAlertsStack/telegram-bot-token \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text)

# Get webhook URL from CloudFormation
WEBHOOK_URL=$(aws cloudformation describe-stacks \
  --stack-name DanfossAlertsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`TelegramWebhookUrl`].OutputValue' \
  --output text)

# Set webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}"
```

## Step 4: Verify Webhook is Set

Check if the webhook is configured correctly:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

You should see a response like:
```json
{
  "ok": true,
  "result": {
    "url": "https://abc123xyz.execute-api.eu-west-1.amazonaws.com/prod/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Step 5: Test the Bot

1. **Open Telegram** and find your bot
2. **Send `/start`** command
3. You should see a welcome message with a **"🌡️ Show Floor Temperature"** button
4. **Click the button** to see current floor temperatures grouped by room

## How It Works

### User Flow:

1. User sends `/start` → Bot responds with welcome message and button
2. User clicks "🌡️ Show Floor Temperature" button → Bot shows "⏳ Fetching temperatures..."
3. Bot fetches data from Danfoss API → Formats by room → Updates message with temperatures
4. User can click "🔄 Refresh" button to update temperatures

### Available Commands:

- `/start` - Show welcome message with temperature button
- `/help` - Show help information

### Button Features:

- **Inline keyboard buttons** - Appear below the message
- **Callback data** - Button clicks are handled via webhook
- **Message editing** - Temperature updates replace the loading message (no spam)
- **Refresh button** - Allows users to update temperatures without sending new commands

## Troubleshooting

### Bot doesn't respond to /start

1. Check webhook is set: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Check Lambda logs in CloudWatch
3. Verify bot token is correct in Parameter Store

### Button doesn't work

1. Check API Gateway logs
2. Check Lambda function logs in CloudWatch
3. Verify the Lambda has permissions to read SSM parameters

### Webhook returns 500 error

1. Check CloudWatch Logs for the Lambda function
2. Verify all environment variables are set correctly
3. Check IAM permissions for SSM Parameter Store access

### Remove Webhook (if needed)

To remove the webhook and stop receiving updates:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

## Security Notes

- The webhook URL is public, but Telegram validates requests
- Consider adding webhook secret token for additional security (future enhancement)
- Lambda function has IAM permissions scoped to necessary resources only
