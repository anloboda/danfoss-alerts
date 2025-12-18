export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  first_name?: string;
  username?: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: any;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

export class BotService {
  private readonly apiUrl: string;

  constructor(botToken: string) {
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup | ReplyKeyboardMarkup,
    parseMode: string = "Markdown"
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          reply_markup: replyMarkup,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(`Telegram API returned error: ${result.description}`);
      }

      return true;
    } catch (error: any) {
      console.error(`Failed to send message: ${error.message}`);
      return false;
    }
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    showAlert: boolean = false
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result.ok === true;
    } catch (error: any) {
      console.error(`Failed to answer callback query: ${error.message}`);
      return false;
    }
  }

  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
    parseMode: string = "Markdown"
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/editMessageText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: parseMode,
          reply_markup: replyMarkup,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result.ok === true;
    } catch (error: any) {
      console.error(`Failed to edit message: ${error.message}`);
      return false;
    }
  }

  static createInlineKeyboard(buttons: InlineKeyboardButton[][]): InlineKeyboardMarkup {
    return {
      inline_keyboard: buttons,
    };
  }

  static createReplyKeyboard(buttons: KeyboardButton[][], options?: {
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
  }): ReplyKeyboardMarkup {
    return {
      keyboard: buttons,
      resize_keyboard: options?.resize_keyboard ?? true,
      one_time_keyboard: options?.one_time_keyboard ?? false,
    };
  }

  static createTemperatureMenuKeyboard(): ReplyKeyboardMarkup {
    return BotService.createReplyKeyboard([
      [
        { text: "🌡️ Показати температуру підлоги" },
      ],
      [
        { text: "🏠 Показати температуру в кімнатах" },
      ],
    ]);
  }
}
