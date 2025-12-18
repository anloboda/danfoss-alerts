import { BotService, TelegramUpdate } from "./services/bot-service";
import { CommandHandler } from "./services/command-handler";
import { TemperatureHandler } from "./services/temperature-handler";
import { DanfossApi } from "../common-lib/danfoss/danfoss-api";
import { SSMHelper } from "../temperature_check/utils/ssm-helper";
import { getEnvVarOrThrow } from "../temperature_check/utils/env-helper";

const botTokenParamName = getEnvVarOrThrow("TELEGRAM_BOT_TOKEN_PARAM_NAME");
const accessTokenParamName = getEnvVarOrThrow("ACCESS_TOKEN_PARAM_NAME");

let botService: BotService;
let commandHandler: CommandHandler;
let temperatureHandler: TemperatureHandler;

let initializationPromise: Promise<void> | null = null;

async function initializeServices() {
  const botToken = await SSMHelper.getRequiredParameter(botTokenParamName, true);
  botService = new BotService(botToken);
  const danfossApi = new DanfossApi(accessTokenParamName);
  commandHandler = new CommandHandler(botService);
  temperatureHandler = new TemperatureHandler(botService, danfossApi);
}

async function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = initializeServices();
  }
  return initializationPromise;
}

export const handler = async (event: any) => {
  try {
    await ensureInitialized();

    const update: TelegramUpdate = JSON.parse(event.body || "{}");

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      if (text.startsWith("/start")) {
        await commandHandler.handleStart(chatId);
      } else if (text === "🌡️ Показати температуру підлоги") {
        await temperatureHandler.handleFloorTemperatureQuery(chatId);
      } else if (text === "🏠 Показати температуру в кімнатах") {
        await temperatureHandler.handleRoomTemperatureQuery(chatId);
      } else if (text.startsWith("/")) {
        await commandHandler.handleUnknownCommand(chatId);
      } else {
        await commandHandler.showMainMenu(chatId);
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error: any) {
    console.error(`Error processing webhook: ${error.message}`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
