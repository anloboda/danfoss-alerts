import { BotService, KeyboardButton } from "./bot-service";

export class CommandHandler {
  private botService: BotService;

  constructor(botService: BotService) {
    this.botService = botService;
  }

  async handleStart(chatId: number): Promise<boolean> {
    const welcomeMessage = `🌡️ *Danfoss Floor Temperature Bot*

Вітаю! Я можу допомогти перевірити поточну температуру підлоги у вашому будинку.

Виберіть дію з меню нижче.`;

    return await this.botService.sendMessage(chatId, welcomeMessage, BotService.createTemperatureMenuKeyboard());
  }

  async handleUnknownCommand(chatId: number): Promise<boolean> {
    const message = `❓ Невідома команда. Використовуйте /start для перегляду доступних опцій.`;

    return await this.botService.sendMessage(chatId, message);
  }

  async showMainMenu(chatId: number): Promise<boolean> {
    return await this.botService.sendMessage(chatId, "Виберіть дію:", BotService.createTemperatureMenuKeyboard());
  }
}
