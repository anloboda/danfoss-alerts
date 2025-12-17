import {
  SSMClient,
  GetParameterCommand,
} from "@aws-sdk/client-ssm";
import {
  SESClient,
  SendEmailCommand,
} from "@aws-sdk/client-ses";

const ssmClient = new SSMClient({});
const ses = new SESClient({});

interface AccessTokenSecret {
  access_token: string;
  token_expires_at?: number;
}

interface DeviceStatus {
  code: string;
  value: number | string | boolean;
}

interface Device {
  id: string;
  name: string;
  status: DeviceStatus[];
}

interface DevicesResponse {
  result: Device[];
  t?: number;
}

interface DeviceAboveThreshold {
  id: string;
  name: string;
  measured_value: number;
  temperature_celsius: number;
}

export const handler = async (event: any, context: any) => {
  const accessTokenParamName = process.env.ACCESS_TOKEN_PARAM_NAME!;
  const temperatureThreshold = parseInt(
    process.env.TEMPERATURE_THRESHOLD || "270"
  );
  const notificationEmailsParamName = process.env.NOTIFICATION_EMAILS_PARAM_NAME;
  // Telegram configuration (optional)
  const telegramBotTokenParamName = process.env.TELEGRAM_BOT_TOKEN_PARAM_NAME;
  const telegramChatIdsParamName = process.env.TELEGRAM_CHAT_IDS_PARAM_NAME;

  try {
    // Get notification emails from Parameter Store
    let notificationEmails: string[] = [];
    if (notificationEmailsParamName) {
      try {
        const emailsResponse = await ssmClient.send(
          new GetParameterCommand({
            Name: notificationEmailsParamName,
            WithDecryption: true,
          })
        );
        const emailsValue = emailsResponse.Parameter?.Value || "";
        notificationEmails = emailsValue.split(",").map((e) => e.trim()).filter((e) => e.length > 0);
        console.log(`Retrieved notification emails from Parameter Store: ${notificationEmails.length} recipient(s)`);
      } catch (error: any) {
        console.error(`Failed to get notification emails from Parameter Store: ${error.message}`);
        throw new Error("Notification emails parameter is required");
      }
    } else {
      // Fallback to environment variable for backward compatibility
      const emailsEnv = process.env.NOTIFICATION_EMAILS;
      if (emailsEnv) {
        notificationEmails = emailsEnv.split(",").map((e) => e.trim());
      } else {
        throw new Error("Notification emails must be configured in Parameter Store or environment variable");
      }
    }

    if (notificationEmails.length === 0) {
      throw new Error("No notification emails configured");
    }

    // Use first notification email as sender (must be verified in SES)
    const senderEmail = process.env.SENDER_EMAIL || notificationEmails[0];

    // Get Telegram credentials from Parameter Store
    let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    let telegramChatIds: string[] = [];

    if (telegramBotTokenParamName) {
      try {
        const telegramTokenResponse = await ssmClient.send(
          new GetParameterCommand({
            Name: telegramBotTokenParamName,
            WithDecryption: true,
          })
        );
        telegramBotToken = telegramTokenResponse.Parameter?.Value;
        console.log("Retrieved Telegram bot token from Parameter Store");
      } catch (error: any) {
        console.warn(`Failed to get Telegram bot token from Parameter Store: ${error.message}`);
      }
    }

    if (telegramChatIdsParamName) {
      try {
        const telegramChatIdsResponse = await ssmClient.send(
          new GetParameterCommand({
            Name: telegramChatIdsParamName,
            WithDecryption: true,
          })
        );
        const chatIdsValue = telegramChatIdsResponse.Parameter?.Value || "";
        telegramChatIds = chatIdsValue.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
        console.log(`Retrieved Telegram chat IDs from Parameter Store: ${telegramChatIds.length} recipient(s)`);
      } catch (error: any) {
        console.warn(`Failed to get Telegram chat IDs from Parameter Store: ${error.message}`);
      }
    } else if (process.env.TELEGRAM_CHAT_IDS) {
      telegramChatIds = process.env.TELEGRAM_CHAT_IDS.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
    } else if (process.env.TELEGRAM_CHAT_ID) {
      // Backward compatibility: support single TELEGRAM_CHAT_ID
      telegramChatIds = [process.env.TELEGRAM_CHAT_ID.trim()];
    }

    // Get access token from parameter
    const tokenResponse = await ssmClient.send(
      new GetParameterCommand({
        Name: accessTokenParamName,
        WithDecryption: true,
      })
    );

    const tokenData: AccessTokenSecret = JSON.parse(
      tokenResponse.Parameter?.Value || "{}"
    );
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("No access_token found in parameter");
    }

    // Get devices from Danfoss API
    const devices = await getDevices(accessToken);

    // Filter out bathroom ("Ванна кімната")
    const devicesToCheck = devices.filter(
      (device) => !device.name?.includes("Ванна кімната")
    );

    console.log(
      `Total devices: ${devices.length}, checking ${devicesToCheck.length} devices (excluding bathroom)`
    );

    // Check temperatures
    const devicesAboveThreshold = checkTemperatures(
      devicesToCheck,
      temperatureThreshold
    );

    // Send notifications if needed
    if (devicesAboveThreshold.length > 0) {
      console.log(
        `Found ${devicesAboveThreshold.length} device(s) above threshold. Sending notifications...`
      );
      await sendNotifications(
        devicesAboveThreshold,
        notificationEmails,
        temperatureThreshold,
        senderEmail,
        telegramBotToken,
        telegramChatIds
      );
    } else {
      console.log(
        `Temperature check completed. All devices are within safe range.`
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Temperature check completed",
        total_devices: devices.length,
        devices_checked: devicesToCheck.length,
        devices_above_threshold: devicesAboveThreshold.length,
      }),
    };
  } catch (error: any) {
    console.error(`Error checking temperature: ${error.message}`);
    throw error;
  }
};

async function getDevices(accessToken: string): Promise<Device[]> {
  const url = "https://api.danfoss.com/ally/devices";
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });

  if (response.status === 401) {
    throw new Error(
      "Unauthorized - access token may be expired. Check token rotation."
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get devices: ${response.status} - ${errorText}`
    );
  }

  const data: DevicesResponse = await response.json();
  return data.result || [];
}

function checkTemperatures(
  devices: Device[],
  threshold: number
): DeviceAboveThreshold[] {
  const devicesAboveThreshold: DeviceAboveThreshold[] = [];

  for (const device of devices) {
    const deviceId = device.id;
    const deviceName = device.name || "Unknown";
    const statusList = device.status || [];

    // Find MeasuredValue in status array
    let measuredValue: number | null = null;
    for (const statusItem of statusList) {
      if (statusItem.code === "MeasuredValue") {
        measuredValue =
          typeof statusItem.value === "number"
            ? statusItem.value
            : parseFloat(String(statusItem.value));
        break;
      }
    }

    if (measuredValue !== null && measuredValue > threshold) {
      const temperatureCelsius = measuredValue / 10.0;
      devicesAboveThreshold.push({
        id: deviceId,
        name: deviceName,
        measured_value: measuredValue,
        temperature_celsius: temperatureCelsius,
      });
      console.log(
        `Alert: Device '${deviceName}' (ID: ${deviceId}) ` +
          `has temperature ${temperatureCelsius}°C (value: ${measuredValue})`
      );
    }
  }

  return devicesAboveThreshold;
}

async function sendNotifications(
  devicesAboveThreshold: DeviceAboveThreshold[],
  emails: string[],
  threshold: number,
  senderEmail: string,
  telegramBotToken?: string,
  telegramChatIds?: string[]
): Promise<void> {
  const thresholdCelsius = threshold / 10.0;

  console.log(`Preparing to send notifications:`);
  console.log(`  - Sender: ${senderEmail}`);
  console.log(`  - Recipients: ${emails.join(", ")}`);
  console.log(`  - Devices above threshold: ${devicesAboveThreshold.length}`);

  // Build email body
  const deviceList = devicesAboveThreshold
    .map(
      (device) =>
        `  - ${device.name} (ID: ${device.id}): ${device.temperature_celsius}°C`
    )
    .join("\n");

  // Use less "spammy" subject (no emoji, no word "Alert")
  const subject = `Danfoss Temperature Warning: ${thresholdCelsius}°C Threshold Exceeded`;
  const bodyText = `Hello Anna,

This is an automated notification from your Danfoss Floor Heating Monitoring System.

The floor temperature has exceeded the threshold of ${thresholdCelsius}°C.

Devices with elevated temperatures:
${deviceList}

Please check your Danfoss floor heating system when convenient.

Best regards,
Danfoss Temperature Monitoring Service

---
This is an automated message. Please do not reply to this email.
`;

  const bodyHtml = `<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #d9534f;">Danfoss Temperature Warning</h2>
    <p>Hello Anna,</p>
    <p>This is an automated notification from your Danfoss Floor Heating Monitoring System.</p>
    <p>The floor temperature has exceeded the threshold of <strong>${thresholdCelsius}°C</strong>.</p>
    
    <h3>Devices with elevated temperatures:</h3>
    <ul>
${devicesAboveThreshold
  .map(
    (device) =>
      `<li><strong>${device.name}</strong>: ${device.temperature_celsius}°C</li>`
  )
  .join("\n")}
    </ul>
    
    <p>Please check your Danfoss floor heating system when convenient.</p>
    
    <p>Best regards,<br>
    Danfoss Temperature Monitoring Service</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #999;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</body>
</html>`;

  // Send email to each recipient
  console.log(`Starting to send emails...`);
  let successCount = 0;
  let failureCount = 0;

  for (const email of emails) {
    try {
      console.log(`Attempting to send email to ${email}...`);
      const response = await ses.send(
        new SendEmailCommand({
          Source: senderEmail,
          Destination: {
            ToAddresses: [email],
          },
          ReplyToAddresses: [senderEmail], // Add Reply-To header
          Message: {
            Subject: {
              Data: subject,
              Charset: "UTF-8",
            },
            Body: {
              Text: {
                Data: bodyText,
                Charset: "UTF-8",
              },
              Html: {
                Data: bodyHtml,
                Charset: "UTF-8",
              },
            },
          },
        })
      );
      console.log(
        `✅ Successfully sent notification to ${email} (MessageId: ${response.MessageId})`
      );
      successCount++;
    } catch (error: any) {
      console.error(
        `❌ Failed to send email to ${email}: ${error.message}`,
        error
      );
      failureCount++;
      // Don't raise - continue sending to other recipients
    }
  }

  console.log(
    `Email sending completed. Success: ${successCount}, Failed: ${failureCount}`
  );

  // Send Telegram notifications if configured
  if (telegramBotToken && telegramChatIds && telegramChatIds.length > 0) {
    try {
      await sendTelegramMessages(
        devicesAboveThreshold,
        thresholdCelsius,
        telegramBotToken,
        telegramChatIds
      );
    } catch (error: any) {
      console.error(`❌ Failed to send Telegram notifications: ${error.message}`);
      // Don't raise - Telegram is optional
    }
  } else {
    console.log("Telegram notifications not configured (missing bot token or chat IDs)");
  }
}

async function sendTelegramMessages(
  devicesAboveThreshold: DeviceAboveThreshold[],
  thresholdCelsius: number,
  botToken: string,
  chatIds: string[]
): Promise<void> {
  console.log(`Sending Telegram notifications to ${chatIds.length} recipient(s)...`);

  // Build Telegram message
  const deviceList = devicesAboveThreshold
    .map(
      (device) =>
        `• ${device.name}: ${device.temperature_celsius}°C`
    )
    .join("\n");

  const message = `🌡️ *Danfoss Temperature Warning*

Hello Anna,

Floor temperature exceeded ${thresholdCelsius}°C threshold.

*Devices with elevated temperatures:*
${deviceList}

Please check your Danfoss floor heating system when convenient.`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // Send to each recipient
  let successCount = 0;
  let failureCount = 0;

  for (const chatId of chatIds) {
    try {
      const chatIdentifier = chatId.trim();
      const chatIdNumber = parseInt(chatIdentifier);
      
      if (isNaN(chatIdNumber)) {
        throw new Error(`Invalid Chat ID: ${chatIdentifier}. Chat ID must be a number.`);
      }
      
      console.log(`Sending Telegram notification to chat ${chatIdNumber}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatIdNumber,
          text: message,
          parse_mode: "Markdown",
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Telegram API error: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      if (!result.ok) {
        const errorMsg = result.description || "Unknown error";
        // Provide helpful error message for common issues
        if (errorMsg.includes("chat not found")) {
          throw new Error(
            `Chat not found. User ${chatIdentifier} must start a conversation with the bot first by sending /start command.`
          );
        }
        throw new Error(`Telegram API returned error: ${errorMsg}`);
      }

      console.log(`✅ Successfully sent Telegram notification to chat ${chatIdNumber} (MessageId: ${result.result.message_id})`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Failed to send Telegram notification to chat ${chatId}: ${error.message}`);
      // Log more details for debugging
      if (error.message.includes("chat not found")) {
        console.error(`💡 Solution: User with Chat ID ${chatId} should open Telegram, find the bot, and send /start command`);
      }
      failureCount++;
      // Continue sending to other recipients
    }
  }

  console.log(
    `Telegram sending completed. Success: ${successCount}, Failed: ${failureCount}`
  );
}

