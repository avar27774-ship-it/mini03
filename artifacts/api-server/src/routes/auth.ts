import { Router } from "express";
import { db } from "@workspace/db";
import { users, authCodes } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, comparePassword, signToken } from "../lib/auth";
import { verifyTelegramWebAppData, sendTelegramMessage } from "../lib/telegram";
import { logger } from "../lib/logger";

const router = Router();

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post("/register", async (req, res) => {
  try {
    const { username, password, code, telegramUsername } = req.body;
    if (!username || !password || !code) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ message: "Username taken" });
      return;
    }

    const cleanTgUser = (telegramUsername || "").replace("@", "").toLowerCase();
    const validCode = await db.select().from(authCodes)
      .where(and(
        eq(authCodes.code, code.toUpperCase()),
        eq(authCodes.telegramUsername, cleanTgUser),
        gt(authCodes.expiresAt, Math.floor(Date.now() / 1000))
      ))
      .limit(1);

    if (validCode.length === 0) {
      res.status(400).json({ message: "Invalid or expired code" });
      return;
    }

    await db.update(authCodes).set({ usedAt: Math.floor(Date.now() / 1000) }).where(eq(authCodes.id, validCode[0].id));

    const hashed = await hashPassword(password);
    const refCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const [user] = await db.insert(users).values({
      username,
      password: hashed,
      telegramUsername: cleanTgUser,
      telegramId: validCode[0].telegramId || undefined,
      refCode,
    }).returning();

    const token = signToken({ userId: user.id, username: user.username, isAdmin: user.isAdmin });
    const { password: _, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    logger.error(err, "Register error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ message: "Missing credentials" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user || !user.password) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ message: "Account banned" });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    await db.update(users).set({ lastActive: Math.floor(Date.now() / 1000) }).where(eq(users.id, user.id));

    const token = signToken({ userId: user.id, username: user.username, isAdmin: user.isAdmin });
    const { password: _, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    logger.error(err, "Login error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/telegram", async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ message: "Missing initData" });
      return;
    }

    const { valid, user: tgUser } = verifyTelegramWebAppData(initData);
    if (!valid || !tgUser) {
      res.status(401).json({ message: "Invalid Telegram data" });
      return;
    }

    const telegramId = String(tgUser.id);
    let [user] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);

    if (!user) {
      const username = tgUser.username || `tg_${telegramId}`;
      const refCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      [user] = await db.insert(users).values({
        username,
        telegramId,
        telegramUsername: tgUser.username || "",
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        refCode,
      }).returning();
    } else {
      await db.update(users).set({ lastActive: Math.floor(Date.now() / 1000) }).where(eq(users.id, user.id));
    }

    const token = signToken({ userId: user.id, username: user.username, isAdmin: user.isAdmin });
    const { password: _, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    logger.error(err, "Telegram auth error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/request-code", async (req, res) => {
  try {
    const { telegramUsername } = req.body;
    if (!telegramUsername) {
      res.status(400).json({ message: "Missing telegram username" });
      return;
    }

    const cleanUsername = telegramUsername.replace("@", "").toLowerCase();
    const code = generateCode();
    const expiresAt = Math.floor(Date.now() / 1000) + 600;

    await db.insert(authCodes).values({
      telegramUsername: cleanUsername,
      code,
      expiresAt,
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (botUsername) {
      logger.info(`Auth code ${code} for @${cleanUsername}. User should send /code to bot @${botUsername}`);
    }

    res.json({ message: "Code generated", botUsername: botUsername || null });
  } catch (err) {
    logger.error(err, "Request code error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  const { authMiddleware } = await import("../lib/auth");
  authMiddleware(req, res, async () => {
    const [user] = await db.select().from(users).where(eq(users.id, (req as any).userId)).limit(1);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });
});

export default router;
