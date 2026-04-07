import { Router } from "express";
import { db } from "@workspace/db";
import { users, transactions } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { createPayment } from "../lib/payments";
import { notifyAdmin } from "../lib/telegram";
import { logger } from "../lib/logger";

const router = Router();

router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const [user] = await db.select({
      balance: users.balance,
      frozenBalance: users.frozenBalance,
      totalDeposited: users.totalDeposited,
      totalWithdrawn: users.totalWithdrawn,
      totalVolume: users.totalVolume,
    }).from(users).where(eq(users.id, (req as any).userId)).limit(1);

    if (!user) { res.status(404).json({ message: "Not found" }); return; }

    res.json({
      balance: user.balance,
      frozenBalance: user.frozenBalance,
      totalDeposited: user.totalDeposited,
      totalWithdrawn: user.totalWithdrawn,
      totalEarned: user.totalVolume,
    });
  } catch (err) {
    logger.error(err, "Get balance error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/deposit", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount, gateway = "rukassa" } = req.body;
    if (!amount || amount < 10) { res.status(400).json({ message: "Min deposit 10 RUB" }); return; }

    const [tx] = await db.insert(transactions).values({
      userId,
      type: "deposit",
      amount: amount.toFixed(2),
      status: "pending",
      gatewayType: gateway,
      description: `Deposit via ${gateway}`,
    }).returning();

    const paymentResult = await createPayment(gateway, amount, tx.id, `Minions Market deposit`);

    if (paymentResult) {
      await db.update(transactions).set({ gatewayOrderId: paymentResult.orderId }).where(eq(transactions.id, tx.id));
      res.json({ transactionId: tx.id, payUrl: paymentResult.payUrl });
    } else {
      await db.update(transactions).set({
        status: "completed",
        balanceBefore: (await db.select({ balance: users.balance }).from(users).where(eq(users.id, userId)).limit(1))[0].balance,
      }).where(eq(transactions.id, tx.id));

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const newBal = (parseFloat(user.balance) + amount).toFixed(2);
      await db.update(users).set({
        balance: newBal,
        totalDeposited: (parseFloat(user.totalDeposited) + amount).toFixed(2),
      }).where(eq(users.id, userId));

      await db.update(transactions).set({ balanceAfter: newBal }).where(eq(transactions.id, tx.id));

      res.json({ transactionId: tx.id, payUrl: null, message: "Deposit credited (test mode)" });
    }
  } catch (err) {
    logger.error(err, "Create deposit error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/withdraw", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { amount, method, details } = req.body;
    if (!amount || amount < 100) { res.status(400).json({ message: "Min withdrawal 100 RUB" }); return; }
    if (!method || !details) { res.status(400).json({ message: "Missing method/details" }); return; }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (parseFloat(user.balance) < amount) { res.status(400).json({ message: "Insufficient funds" }); return; }

    const newBal = (parseFloat(user.balance) - amount).toFixed(2);
    await db.update(users).set({ balance: newBal }).where(eq(users.id, userId));

    const [tx] = await db.insert(transactions).values({
      userId,
      type: "withdrawal",
      amount: amount.toFixed(2),
      status: "pending",
      withdrawMethod: method,
      withdrawDetails: details,
      description: `Withdrawal via ${method}: ${details}`,
      balanceBefore: user.balance,
      balanceAfter: newBal,
    }).returning();

    await notifyAdmin(`New withdrawal request: ${amount} ₽ via ${method}`);

    res.json({ transactionId: tx.id, message: "Withdrawal request created" });
  } catch (err) {
    logger.error(err, "Create withdrawal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/transactions", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { type, page = "1", limit = "20" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(transactions.userId, userId)];
    if (type) conditions.push(eq(transactions.type, type));
    const where = and(...conditions);

    const txs = await db.select().from(transactions)
      .where(where)
      .orderBy(desc(transactions.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(transactions).where(where);

    res.json({ transactions: txs, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) });
  } catch (err) {
    logger.error(err, "List transactions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/webhook/:gateway", async (req, res) => {
  try {
    const { gateway } = req.params;
    const body = req.body;
    logger.info({ gateway, body }, "Payment webhook received");

    let orderId: string | null = null;
    let status = "completed";

    if (gateway === "rukassa") {
      orderId = body.order_id;
      if (body.status === "PAID") status = "completed";
      else { res.json({ ok: true }); return; }
    } else if (gateway === "nowpayments") {
      orderId = body.order_id;
      if (body.payment_status === "finished") status = "completed";
      else { res.json({ ok: true }); return; }
    } else if (gateway === "crystalpay") {
      orderId = body.extra;
      status = "completed";
    }

    if (!orderId) { res.status(400).json({ message: "Invalid webhook" }); return; }

    const [tx] = await db.select().from(transactions).where(eq(transactions.id, orderId)).limit(1);
    if (!tx || tx.status !== "pending") { res.json({ ok: true }); return; }

    const [user] = await db.select().from(users).where(eq(users.id, tx.userId)).limit(1);
    const amount = parseFloat(tx.amount);
    const newBal = (parseFloat(user.balance) + amount).toFixed(2);

    await db.update(users).set({
      balance: newBal,
      totalDeposited: (parseFloat(user.totalDeposited) + amount).toFixed(2),
    }).where(eq(users.id, tx.userId));

    await db.update(transactions).set({
      status: "completed",
      balanceBefore: user.balance,
      balanceAfter: newBal,
    }).where(eq(transactions.id, tx.id));

    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Webhook error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
