# Danfoss Floor Temperature Monitoring Service

Serverless AWS service for monitoring Danfoss floor heating temperature and sending email and Telegram alerts when temperature exceeds 27°C.

## Architecture

- **AWS Lambda** (Node.js 20) functions:
  - Token Rotation: Refreshes OAuth2 access token every 55 minutes
  - Temperature Check: Monitors floor temperature every 30 minutes and sends alerts

- **AWS Systems Manager Parameter Store**:
  - `/DanfossAlertsStack/danfoss-credentials`: Stores Consumer Key and Secret (static, encrypted)
  - `/DanfossAlertsStack/danfoss-access-token`: Stores OAuth2 access token (rotated, encrypted)
  - `/DanfossAlertsStack/notification-emails`: Stores email addresses for notifications (encrypted)
  - `/DanfossAlertsStack/telegram-bot-token`: Stores Telegram bot token (encrypted)
  - `/DanfossAlertsStack/telegram-chat-ids`: Stores Telegram chat IDs (encrypted)

- **Amazon EventBridge**: Scheduled triggers for Lambda functions

- **Amazon SES**: Email notifications

- **Telegram Bot API**: Telegram notifications (optional)

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **AWS CDK** installed: `npm install -g aws-cdk`
3. **Node.js 18+** installed
4. **Danfoss API credentials** (Consumer Key and Consumer Secret)

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install:
- CDK dependencies
- TypeScript and build tools
- Lambda function dependencies (from their package.json files)

### 2. Build the Project

```bash
npm run build
```

### 3. Bootstrap CDK (first time only)

```bash
cdk bootstrap
```

### 4. Deploy Infrastructure

```bash
cdk deploy
```

### 5. Configure Parameters

After deployment, you need to manually populate the parameters:

#### a) Credentials Parameter

Update the credentials parameter with your Danfoss API credentials:

```bash
aws ssm put-parameter \
  --name /DanfossAlertsStack/danfoss-credentials \
  --value '{
    "client_id": "YOUR_CONSUMER_KEY",
    "client_secret": "YOUR_CONSUMER_SECRET",
    "token_url": "https://api.danfoss.com/oauth2/token"
  }' \
  --type SecureString \
  --overwrite
```

Or use AWS Console:
1. Go to AWS Systems Manager → **Parameter Store**
2. Find parameter: `/DanfossAlertsStack/danfoss-credentials`
3. Click "Edit"
4. Update with your credentials (paste JSON)

#### b) Initialize Access Token Parameter

The access token parameter will be populated automatically by the rotation function, but you can trigger it manually:

1. Go to AWS Lambda Console
2. Find function: `DanfossAlertsStack-token-rotation`
3. Click "Test" → Create test event → "Test"

Or wait for the first scheduled run (every 55 minutes).

### 6. Verify Email Addresses in SES

Before emails can be sent, you need to verify recipient emails in SES:

1. Go to AWS SES Console → **Verified identities**
2. Click **Create identity**
3. Choose **Email address**
4. Enter email address (e.g., `your-email@example.com`)
5. Click **Create identity**
6. Check your email inbox and click the verification link
7. Repeat for the second email address

**Note**: The sender email will default to the first notification email address, which must also be verified in SES.

## How It Works

1. **Token Rotation** (every 55 minutes):
   - Lambda function reads Consumer Key/Secret from credentials parameter
   - Calls Danfoss OAuth2 endpoint to get new access token
   - Stores token in access_token parameter

2. **Temperature Check** (every 30 minutes):
   - Lambda function reads access token from parameter
   - Calls Danfoss API: `GET https://api.danfoss.com/ally/devices`
   - Filters out bathroom devices ("Ванна кімната")
   - Checks `MeasuredValue` for each device (value = temperature * 10, so 270 = 27.0°C)
   - If any device temperature > 27°C (270), sends email and Telegram alerts

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### CDK Commands

```bash
# Synthesize CloudFormation template
npm run synth

# Deploy stack
npm run deploy

# Diff stack
cdk diff

# Destroy stack
cdk destroy
```

## Configuration

### Temperature Threshold

Default: 27°C (270 in API units)

To change, update in `lib/danfoss-alerts-stack.ts`:
```typescript
TEMPERATURE_THRESHOLD: "270", // Change to desired value (e.g., "280" for 28°C)
```

### Check Frequency

Default: Every 30 minutes

To change, update schedule in `lib/danfoss-alerts-stack.ts`:
```typescript
schedule: events.Schedule.rate(cdk.Duration.minutes(30)), // Change as needed
```

### Token Rotation Frequency

Default: Every 55 minutes (token expires in 60 minutes)

To change:
```typescript
schedule: events.Schedule.rate(cdk.Duration.minutes(55)), // Adjust if needed
```

### Notification Emails

To change notification emails, update the Parameter Store:

```bash
aws ssm put-parameter \
  --name /DanfossAlertsStack/notification-emails \
  --value "email1@example.com,email2@example.com" \
  --type SecureString \
  --overwrite
```

## Monitoring

View logs in CloudWatch:
- Token Rotation: `/aws/lambda/DanfossAlertsStack-token-rotation`
- Temperature Check: `/aws/lambda/DanfossAlertsStack-temperature-check`

## Troubleshooting

### "Unauthorized" errors in Temperature Check

- Check if token rotation is working
- Verify credentials parameter is populated correctly
- Check CloudWatch logs for token rotation function

### Emails not being sent

- Verify email addresses in SES Console
- Check SES is not in sandbox mode (or verify sender email)
- Check CloudWatch logs for errors

### Token rotation not working

- Verify credentials parameter has correct `client_id` and `client_secret`
- Check IAM permissions for Lambda to read/write parameters
- Check CloudWatch logs for errors

## Cleanup

To remove all resources:

```bash
cdk destroy
```

**Note**: Parameters will be deleted. Make sure you have a backup of your credentials.

## License

Private project
