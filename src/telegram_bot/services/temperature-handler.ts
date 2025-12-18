import { BotService } from "./bot-service";
import { DanfossApi, Device } from "../../../common-lib/danfoss/danfoss-api";

type TemperatureType = "floor" | "room";

export class TemperatureHandler {
  private botService: BotService;
  private danfossApi: DanfossApi;

  constructor(botService: BotService, danfossApi: DanfossApi) {
    this.botService = botService;
    this.danfossApi = danfossApi;
  }

  async handleTemperatureQuery(chatId: number, type: TemperatureType): Promise<boolean> {
    const config = type === "floor" 
      ? {
          loadingMessage: "⏳ Отримую дані про температуру підлоги...",
          statusCode: "MeasuredValue",
          header: "🌡️ *Поточна температура підлоги*",
          errorLog: "Error fetching temperatures",
          errorMessage: "❌ Помилка отримання температури підлоги"
        }
      : {
          loadingMessage: "⏳ Отримую дані про температуру в кімнатах...",
          statusCode: "temp_current",
          header: "🏠 *Температура в кімнатах*",
          errorLog: "Error fetching room temperatures",
          errorMessage: "❌ Помилка отримання температури в кімнатах"
        };

    try {
      await this.botService.sendMessage(chatId, config.loadingMessage);

      const devices = await this.danfossApi.getDevices();
      const deviceTemperatures = this.getDeviceTemperatures(devices, config.statusCode);
      const message = this.formatTemperatureMessage(deviceTemperatures, config.header);

      return await this.botService.sendMessage(chatId, message, BotService.createTemperatureMenuKeyboard());
    } catch (error: any) {
      console.error(`${config.errorLog}: ${error.message}`);
      const errorMessage = `${config.errorMessage}: ${error.message}\n\nБудь ласка, спробуйте пізніше.`;

      await this.botService.sendMessage(chatId, errorMessage, BotService.createTemperatureMenuKeyboard());
      return false;
    }
  }

  async handleFloorTemperatureQuery(chatId: number): Promise<boolean> {
    return this.handleTemperatureQuery(chatId, "floor");
  }

  async handleRoomTemperatureQuery(chatId: number): Promise<boolean> {
    return this.handleTemperatureQuery(chatId, "room");
  }

  private getDeviceTemperatures(devices: Device[], statusCode: string): Array<{ name: string; temperature: number }> {
    const deviceTemperatures: Array<{ name: string; temperature: number }> = [];

    for (const device of devices) {
      const deviceName = device.name || "Unknown";
      const statusList = device.status || [];

      // Find the specified status code (MeasuredValue or temp_current)
      let temperatureValue: number | null = null;
      for (const statusItem of statusList) {
        if (statusItem.code === statusCode) {
          temperatureValue =
            typeof statusItem.value === "number"
              ? statusItem.value
              : parseFloat(String(statusItem.value));
          break;
        }
      }

      if (temperatureValue !== null) {
        // Both MeasuredValue and temp_current are in tenths of degrees (270 = 27.0°C, 200 = 20.0°C)
        const temperatureCelsius = temperatureValue / 10.0;
        deviceTemperatures.push({ name: deviceName, temperature: temperatureCelsius });
      }
    }

    return deviceTemperatures;
  }

  private formatTemperatureMessage(deviceTemperatures: Array<{ name: string; temperature: number }>, header: string = "🌡️ *Поточна температура підлоги*"): string {
    if (deviceTemperatures.length === 0) {
      return "❌ Дані про температуру недоступні.";
    }

    const lines: string[] = [`${header}\n`];

    // Sort devices alphabetically
    const sortedDevices = [...deviceTemperatures].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const { name, temperature } of sortedDevices) {
      const roomName = this.extractRoomName(name);
      const emoji = this.getRoomEmoji(roomName);
      lines.push(`${emoji} *${name}*: ${temperature.toFixed(1)}°C`);
    }

    const now = new Date();
    const timestamp = now.toLocaleString("uk-UA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    lines.push(`\n_Оновлено: ${timestamp}_`);

    return lines.join("\n");
  }

  private extractRoomName(deviceName: string): string {
    // Try to extract room name from device name
    // This is a simple implementation - you may need to customize based on your naming convention
    // Examples: "Living Room Sensor" -> "Living Room", "Kitchen Floor" -> "Kitchen"
    
    // Remove common suffixes
    const cleaned = deviceName
      .replace(/\s*(Sensor|Floor|Thermostat|Device).*$/i, "")
      .trim();

    // If cleaned name is too short or empty, use original
    if (cleaned.length < 2) {
      return deviceName;
    }

    return cleaned;
  }

  private getRoomEmoji(roomName: string): string {
    const name = roomName.toLowerCase();
    if (name.includes("вітальня")) return "🛋️";
    if (name.includes("спальня")) return "🛏️";
    if (name.includes("кухня")) return "🍳";
    if (name.includes("ванна кімната")) return "🚿";
    return "🏠";
  }
}
