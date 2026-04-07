import { db } from "@workspace/db";
import { authCodes } from "@workspace/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Установить вебхук: вызови один раз после деплоя
// POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain/api/bot/webhook

async function sendMessage(chatId: number | string, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

export async function handleBotUpdate(update: any) {
  try {
    const message = update?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const from = message.from;
    const text = message.text.trim();
    const username = (from?.username || "").toLowerCase();

    // /start или /code — выдать код по username
    if (text === "/start" || text.startsWith("/code")) {
      if (!username) {
        await sendMessage(chatId, "❌ У вас нет username в Telegram. Установите его в настройках и попробуйте снова.");
        return;
      }

      const now = Math.floor(Date.now() / 1000);

      // Ищем свежий неиспользованный код для этого username
      const [authCode] = await db
        .select()
        .from(authCodes)
        .where(
          and(
            eq(authCodes.telegramUsername, username),
            gt(authCodes.expiresAt, now),
            isNull(authCodes.usedAt)
          )
        )
        .orderBy(authCodes.createdAt)
        .limit(1);

      if (!authCode) {
        await sendMessage(
          chatId,
          "❌ Код не найден или истёк.\n\nСначала введите ваш @username на сайте, затем нажмите «Получить код»."
        );
        return;
      }

      // Сохраняем telegramId в коде, чтобы привязать аккаунт
      await db
        .update(authCodes)
        .set({ telegramId: String(from.id) })
        .where(eq(authCodes.id, authCode.id));

      const minutesLeft = Math.ceil((authCode.expiresAt - now) / 60);

      await sendMessage(
        chatId,
        `✅ Ваш код подтверждения:\n\n<b>${authCode.code}</b>\n\nВведите его на сайте. Код действует ещё ${minutesLeft} мин.`
      );
      return;
    }

    // Любое другое сообщение — подсказка
    await sendMessage(
      chatId,
      "👋 Привет! Я бот для авторизации на Minions Market.\n\n1. Перейдите на сайт и введите ваш @username\n2. Нажмите «Получить код»\n3. Вернитесь сюда и напишите /start"
    );
  } catch (err) {
    logger.error(err, "Bot update error");
  }
}
