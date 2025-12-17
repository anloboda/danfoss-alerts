# Додавання команд до Telegram бота

## Ідея

Дозволити користувачам надсилати команди боту (наприклад, `/temp` або `/status`), і бот відповідає поточними температурами з усіх кімнат.

## Архітектура

### Варіант 1: Webhook (рекомендовано) ⭐

```
[Telegram] → [API Gateway] → [Lambda (Command Handler)] → [Danfoss API] → [Lambda] → [Telegram]
```

**Як працює:**
1. Користувач надсилає команду `/temp` боту
2. Telegram надсилає webhook на ваш API Gateway endpoint
3. API Gateway викликає Lambda функцію
4. Lambda обробляє команду, отримує температури з Danfoss API
5. Lambda надсилає відповідь назад через Telegram Bot API

### Варіант 2: Long Polling (простіше для тестування)

```
[Lambda (Polling)] → [Telegram getUpdates API] → [Обробка команд] → [Danfoss API] → [Telegram]
```

**Як працює:**
1. Lambda функція запускається кожні 10-30 секунд (через EventBridge)
2. Lambda викликає `getUpdates` API Telegram
3. Отримує нові повідомлення/команди
4. Обробляє команди і надсилає відповіді

---

## Кроки реалізації (Webhook варіант)

### 1. Створити Lambda функцію для обробки команд

**Новий файл:** `src/telegram_command_handler/index.ts`

```typescript
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({});

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text: string;
  };
}

export const handler = async (event: any) => {
  // Отримати webhook від Telegram
  const update: TelegramUpdate = JSON.parse(event.body);
  
  if (!update.message) {
    return { statusCode: 200 }; // Ignore non-message updates
  }
  
  const chatId = update.message.chat.id;
  const command = update.message.text?.trim();
  
  // Обробка команди
  if (command === '/temp' || command === '/status' || command === '/temperature') {
    await handleTemperatureCommand(chatId);
  } else {
    // Не знайома команда - надіслати допомогу
    await sendMessage(chatId, "Використайте /temp для отримання поточних температур");
  }
  
  return { statusCode: 200 };
};

async function handleTemperatureCommand(chatId: number) {
  try {
    // 1. Отримати access_token з Parameter Store
    const tokenParam = await ssmClient.send(
      new GetParameterCommand({
        Name: process.env.ACCESS_TOKEN_PARAM_NAME!,
        WithDecryption: true,
      })
    );
    
    const tokenData = JSON.parse(tokenParam.Parameter?.Value || "{}");
    const accessToken = tokenData.access_token;
    
    // 2. Викликати Danfoss API для отримання пристроїв
    const response = await fetch("https://api.danfoss.com/ally/devices", {
      headers: {
        "accept": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    const devices = data.result || [];
    
    // 3. Форматувати відповідь з температурами
    let message = "🌡️ *Поточні температури:*\n\n";
    
    for (const device of devices) {
      if (device.device_type?.includes("RT")) { // Тільки термостатисти
        const status = device.status?.find((s: any) => s.code === "MeasuredValue");
        const tempCelsius = status ? (status.value / 10.0).toFixed(1) : "N/A";
        
        message += `*${device.name}*\n`;
        message += `Температура: ${tempCelsius}°C\n\n`;
      }
    }
    
    // 4. Надіслати відповідь користувачу
    await sendMessage(chatId, message);
    
  } catch (error: any) {
    await sendMessage(chatId, `❌ Помилка: ${error.message}`);
  }
}

async function sendMessage(chatId: number, text: string) {
  const botToken = await getBotToken();
  
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    }),
  });
}

async function getBotToken(): Promise<string> {
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: process.env.TELEGRAM_BOT_TOKEN_PARAM_NAME!,
      WithDecryption: true,
    })
  );
  return response.Parameter?.Value || "";
}
```

### 2. Створити API Gateway endpoint

**В CDK Stack додати:**

```typescript
// API Gateway для Telegram webhook
const api = new apigateway.RestApi(this, "TelegramWebhookApi", {
  restApiName: `${this.stackName}-telegram-webhook`,
  description: "API Gateway for Telegram bot commands",
});

// Lambda інтеграція
const commandHandler = new NodejsFunction(this, "TelegramCommandHandler", {
  functionName: `${this.stackName}-telegram-command-handler`,
  runtime: lambda.Runtime.NODEJS_20_X,
  entry: "src/telegram_command_handler/index.ts",
  handler: "handler",
  environment: {
    ACCESS_TOKEN_PARAM_NAME: accessTokenParam.parameterName,
    TELEGRAM_BOT_TOKEN_PARAM_NAME: `/${this.stackName}/telegram-bot-token`,
  },
  // ... інші налаштування
});

// POST endpoint для webhook
const webhookResource = api.root.addResource("webhook");
webhookResource.addMethod("POST", new apigateway.LambdaIntegration(commandHandler));

// Output API URL
new cdk.CfnOutput(this, "TelegramWebhookUrl", {
  value: api.url + "webhook",
  description: "Telegram webhook URL - set this in BotFather",
});
```

### 3. Налаштувати webhook в Telegram

```bash
# Після деплою, отримати webhook URL з CloudFormation outputs
WEBHOOK_URL="https://your-api-id.execute-api.region.amazonaws.com/prod/webhook"
BOT_TOKEN="YOUR_BOT_TOKEN_HERE"

# Налаштувати webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}"
```

Або через BotFather:
1. Відкрити @BotFather
2. Надіслати `/setwebhook`
3. Надіслати URL: `https://your-api-url/webhook`

### 4. Тестування

1. Відкрити Telegram
2. Знайти вашого бота
3. Надіслати команду `/temp`
4. Отримати відповідь з температурами

---

## Варіант 2: Long Polling (простіший, але менш ефективний)

### Створити Lambda для polling

```typescript
export const handler = async () => {
  const botToken = await getBotToken();
  const lastUpdateId = await getLastUpdateId(); // Зберегти в Parameter Store або DynamoDB
  
  // Отримати нові оновлення
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}`
  );
  
  const updates = await response.json();
  
  for (const update of updates.result) {
    if (update.message?.text === '/temp') {
      await handleTemperatureCommand(update.message.chat.id);
    }
    lastUpdateId = Math.max(lastUpdateId, update.update_id);
  }
  
  await saveLastUpdateId(lastUpdateId);
};
```

### Налаштувати EventBridge для запуску кожні 10 секунд

```typescript
const pollingRule = new events.Rule(this, "TelegramPollingRule", {
  schedule: events.Schedule.rate(cdk.Duration.seconds(10)),
});
pollingRule.addTarget(new targets.LambdaFunction(commandHandler));
```

---

## Переваги кожного варіанту

### Webhook (Варіант 1):
✅ Миттєва відповідь  
✅ Ефективніше (працює тільки коли є повідомлення)  
✅ Менше викликів Lambda  
✅ Стандартний підхід для Telegram ботів  

### Long Polling (Варіант 2):
✅ Простіше налаштувати (не потрібен API Gateway)  
✅ Дешевше (менше AWS сервісів)  
❌ Затримка до 10-30 секунд  
❌ Більше викликів Lambda (кожні 10-30 секунд навіть без повідомлень)  

---

## Додаткові ідеї для команд

- `/temp` - поточні температури
- `/help` - список доступних команд
- `/status` - детальна інформація про всі пристрої
- `/room <назва>` - температура конкретної кімнати
- `/threshold` - показати поточний поріг температури
- `/history` - історія змін (потрібна БД для зберігання)

---

## Безпека

⚠️ Важливо додати валідацію:
- Перевіряти, що повідомлення дійсно від Telegram
- Верифікувати секретний токен від Telegram
- Перевіряти, що chat_id є в дозволеному списку (опціонально)

```typescript
// Перевірка що це дійсно Telegram
const secretToken = event.headers['x-telegram-bot-api-secret-token'];
if (secretToken !== process.env.WEBHOOK_SECRET) {
  return { statusCode: 403 };
}
```

---

## Висновок

**Рекомендовано використати Webhook (Варіант 1)** - це стандартний і найефективніший спосіб для Telegram ботів.

**Мінімальні зміни для реалізації:**
1. Створити `src/telegram_command_handler/index.ts`
2. Додати API Gateway + Lambda в CDK
3. Налаштувати webhook через BotFather
4. Протестувати команду `/temp`

