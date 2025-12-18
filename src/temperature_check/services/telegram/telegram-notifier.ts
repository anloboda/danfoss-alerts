import { DeviceAboveThreshold } from "../danfoss/danfoss-api";
import { SSMHelper } from "../../utils/ssm-helper";

export class TelegramNotifier {
  private botTokenParamName: string;
  private chatIdsParamName: string;

  constructor(botTokenParamName: string, chatIdsParamName: string) {
    this.botTokenParamName = botTokenParamName;
    this.chatIdsParamName = chatIdsParamName;
  }

  async getChatIds(): Promise<string[]> {
    const chatIdsValue = await SSMHelper.getParameter(this.chatIdsParamName, true);
    return SSMHelper.parseCommaSeparatedList(chatIdsValue);
  }

  async sendNotifications(
    devicesAboveThreshold: DeviceAboveThreshold[],
    thresholdCelsius: number
  ): Promise<void> {
    const botToken = await SSMHelper.getParameter(this.botTokenParamName, true);

    const chatIds = await this.getChatIds();
    if (chatIds.length === 0) {
      console.log("Telegram notifications not configured (missing chat IDs)");
      return;
    }
    console.log(`Sending Telegram notifications to ${chatIds.length} recipient(s)...`);

    const message = this.buildMessage(devicesAboveThreshold, thresholdCelsius);
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Send to each recipient
    let successCount = 0;
    let failureCount = 0;

    for (const chatId of chatIds) {
      const success = await this.sendToChat(chatId, url, message);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    console.log(
      `Telegram sending completed. Success: ${successCount}, Failed: ${failureCount}`
    );
  }

  private async sendToChat(
    chatId: string,
    url: string,
    message: string
  ): Promise<boolean> {
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
        if (errorMsg.includes("chat not found")) {
          throw new Error(
            `Chat not found. User ${chatIdentifier} must start a conversation with the bot first by sending /start command.`
          );
        }
        throw new Error(`Telegram API returned error: ${errorMsg}`);
      }

      console.log(`✅ Successfully sent Telegram notification to chat ${chatIdNumber} (MessageId: ${result.result.message_id})`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to send Telegram notification to chat ${chatId}: ${error.message}`);
      // Log more details for debugging
      if (error.message.includes("chat not found")) {
        console.error(`💡 Solution: User with Chat ID ${chatId} should open Telegram, find the bot, and send /start command`);
      }
      return false;
    }
  }

  private buildMessage(
    devicesAboveThreshold: DeviceAboveThreshold[],
    thresholdCelsius: number
  ): string {
    const deviceList = devicesAboveThreshold
      .map((device) => `• ${device.name}: ${device.temperature_celsius}°C`)
      .join("\n");

    return `🌡️ *Danfoss Temperature Warning*

Hello Anna,

Floor temperature exceeded ${thresholdCelsius}°C threshold.

*Devices with elevated temperatures:*
${deviceList}

Please check your Danfoss floor heating system when convenient.`;
  }
}
