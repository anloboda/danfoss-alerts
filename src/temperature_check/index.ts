import { DanfossApi } from "../common-lib/danfoss/danfoss-api";
import { EmailNotifier } from "./services/email/email-notifier";
import { TelegramNotifier } from "./services/telegram/telegram-notifier";
import { TemperatureChecker } from "./services/temperature/temperature-checker";
import { getEnvVarOrThrow } from "./utils/env-helper";

export const handler = async (event: any, context: any) => {
  const accessTokenParamName = getEnvVarOrThrow("ACCESS_TOKEN_PARAM_NAME");
  const temperatureThreshold = parseInt(getEnvVarOrThrow("TEMPERATURE_THRESHOLD"));
  const notificationEmailsParamName = getEnvVarOrThrow("NOTIFICATION_EMAILS_PARAM_NAME");
  const telegramBotTokenParamName = getEnvVarOrThrow("TELEGRAM_BOT_TOKEN_PARAM_NAME");
  const telegramChatIdsParamName = getEnvVarOrThrow("TELEGRAM_CHAT_IDS_PARAM_NAME");

  try {
      const danfossApi = new DanfossApi(accessTokenParamName);
      const devicesToCheck = await danfossApi.getDevices("Ванна кімната");

      const temperatureChecker = new TemperatureChecker();
      const devicesAboveThreshold = temperatureChecker.checkTemperatures(
        devicesToCheck,
        temperatureThreshold
      );

    if (devicesAboveThreshold.length > 0) {
      console.log(
        `Found ${devicesAboveThreshold.length} device(s) above threshold. Sending notifications...`
      );

      const thresholdCelsius = temperatureThreshold / 10.0;

      const emailNotifier = new EmailNotifier(notificationEmailsParamName);
      await emailNotifier.sendNotifications(
        devicesAboveThreshold,
        thresholdCelsius
      );

      const telegramNotifier = new TelegramNotifier(
        telegramBotTokenParamName,
        telegramChatIdsParamName
      );
      await telegramNotifier.sendNotifications(
        devicesAboveThreshold,
        thresholdCelsius
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
        devices_checked: devicesToCheck.length,
        devices_above_threshold: devicesAboveThreshold.length,
      }),
    };
  } catch (error: any) {
    console.error(`Error checking temperature: ${error.message}`);
    throw error;
  }
};
