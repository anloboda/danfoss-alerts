# AWS Cost Estimate - Danfoss Alerts Service

## Monthly Costs Breakdown

### 1. AWS Lambda
- **Token Rotation**: ~720 invocations/month (every 55 minutes)
- **Temperature Check**: ~1,440 invocations/month (every 30 minutes)
- **Total**: ~2,160 invocations/month
- **Free Tier**: 1,000,000 invocations/month
- **Cost**: **$0.00** ✅

### 2. AWS Systems Manager Parameter Store
- **Parameters**: 2 SecureString parameters (credentials + access_token)
- **Cost**: **$0.00/month** ✅ (Standard parameters are FREE, uses AWS managed KMS key)

### 3. Amazon SES (Email)
- **Estimated**: 20-40 emails/month (assuming 10-20 alert events, 2 recipients per alert)
- **Free Tier Options**:
  - **Option 1**: 62,000 emails/month when sent from EC2/Lambda (in certain regions)
  - **Option 2**: 3,000 emails/month for new accounts (first 12 months)
- **After Free Tier**: $0.10 per 1,000 emails
- **Your Cost**: **$0.00** ✅ (well within free tier limits)
- **Even at 100 emails/month**: $0.00 (free tier covers it)
- **At 1,000 emails/month**: Still $0.00 if using Lambda
- **At 10,000 emails/month**: ~$1.00/month (after free tier)

### 4. Amazon EventBridge
- **Rules**: 2 scheduled rules
- **Events**: ~2,160 events/month
- **Free Tier**: 14,000 custom events/month
- **Cost**: **$0.00** ✅

### 5. CloudWatch Logs
- **Estimated**: ~2-5 MB logs/month
- **Free Tier**: 5 GB/month
- **Cost**: **$0.00** ✅

## Total Monthly Cost

**Estimated: ~$0.00/month** ✅ (FREE - all services within free tier limits)

## Optional: SMS via SNS

### SMS Pricing by Country:

**United States:**
- First 100 SMS/month: FREE
- After that: ~$0.0075 per SMS
- Example: 20 SMS/month = $0.00, 200 SMS/month = ~$0.75

**Ukraine (Україна):**
- **Cost**: ~$0.42-$0.62 per SMS (depends on mobile operator)
  - Astelit: $0.622 per SMS
  - Other operators: $0.546 per SMS
  - Standard SMS: $0.423 per SMS
- **Example**: 
  - 20 SMS/month = **~$8.50-$12.40/month** 💰
  - 100 SMS/month = **~$42-$62/month** 💰

**Important:** SMS to Ukraine is significantly more expensive than email or US SMS. Email notifications are much more cost-effective.

## Notes

- Costs assume minimal alert frequency (not constant alerts)
- Actual costs may vary based on actual usage
- Monitor via AWS Billing Dashboard
- Free tier limits reset monthly

## Links

- [AWS Pricing Calculator](https://calculator.aws/#/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [AWS Systems Manager Parameter Store Pricing](https://aws.amazon.com/systems-manager/pricing/) (FREE for Standard parameters)
- [Amazon SES Pricing](https://aws.amazon.com/ses/pricing/)
- [Amazon SNS SMS Pricing](https://aws.amazon.com/sns/sms-pricing/) (check country-specific rates)


