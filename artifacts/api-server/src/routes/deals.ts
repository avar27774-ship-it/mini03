import { Router } from "express";
import { db } from "@workspace/db";
import { deals, products, users, reviews, transactions } from "@workspace/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { notifyAdmin } from "../lib/telegram";
import { logger } from "../lib/logger";

const router = Router();
const COMMISSION_RATE = 0.07;

async function getNextDealNumber(): Promise<number> {
  const [result] = await db.select({ max: sql<number>`coalesce(max(deal_number), 1000)::int` }).from(deals);
  return (result.max || 1000) + 1;
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { role = "all", page = "1", limit = "20" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    let where;
    if (role === "buyer") where = eq(deals.buyerId, userId);
    else if (role === "seller") where = eq(deals.sellerId, userId);
    else where = or(eq(deals.buyerId, userId), eq(deals.sellerId, userId));

    const dealsList = await db.select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      buyerId: deals.buyerId,
      sellerId: deals.sellerId,
      productId: deals.productId,
      amount: deals.amount,
      sellerAmount: deals.sellerAmount,
      commission: deals.commission,
      status: deals.status,
      createdAt: deals.createdAt,
    }).from(deals)
      .where(where)
      .orderBy(desc(deals.createdAt))
      .limit(limitNum)
      .offset(offset);

    const enriched = await Promise.all(dealsList.map(async (deal) => {
      const [product] = await db.select({ title: products.title, images: products.images }).from(products).where(eq(products.id, deal.productId)).limit(1);
      const [buyer] = await db.select({ username: users.username }).from(users).where(eq(users.id, deal.buyerId)).limit(1);
      const [seller] = await db.select({ username: users.username }).from(users).where(eq(users.id, deal.sellerId)).limit(1);
      return { ...deal, product, buyer, seller };
    }));

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(deals).where(where);

    res.json({ deals: enriched, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) });
  } catch (err) {
    logger.error(err, "List deals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const buyerId = (req as any).userId;
    const { productId } = req.body;
    if (!productId) { res.status(400).json({ message: "Missing productId" }); return; }

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product || product.status !== "active") { res.status(400).json({ message: "Product not available" }); return; }
    if (product.sellerId === buyerId) { res.status(400).json({ message: "Cannot buy your own product" }); return; }

    const [buyer] = await db.select().from(users).where(eq(users.id, buyerId)).limit(1);
    const price = parseFloat(product.price);
    if (parseFloat(buyer.balance) < price) { res.status(400).json({ message: "Insufficient funds" }); return; }

    const commission = Math.round(price * COMMISSION_RATE * 100) / 100;
    const sellerAmount = price - commission;
    const dealNumber = await getNextDealNumber();

    const newBalance = parseFloat(buyer.balance) - price;
    await db.update(users).set({
      balance: newBalance.toFixed(2),
      frozenBalance: (parseFloat(buyer.frozenBalance) + price).toFixed(2),
      totalPurchases: buyer.totalPurchases + 1,
    }).where(eq(users.id, buyerId));

    await db.insert(transactions).values({
      userId: buyerId,
      type: "purchase",
      amount: price.toFixed(2),
      status: "completed",
      description: `Purchase: ${product.title}`,
      balanceBefore: buyer.balance,
      balanceAfter: newBalance.toFixed(2),
    });

    const [deal] = await db.insert(deals).values({
      dealNumber,
      buyerId,
      sellerId: product.sellerId,
      productId: product.id,
      amount: price.toFixed(2),
      sellerAmount: sellerAmount.toFixed(2),
      commission: commission.toFixed(2),
      status: "paid",
      autoCompleteAt: Math.floor(Date.now() / 1000) + 86400 * 3,
    }).returning();

    if (product.deliveryType === "auto" && product.deliveryData) {
      await db.update(deals).set({ status: "delivered", deliveryData: product.deliveryData }).where(eq(deals.id, deal.id));
      deal.status = "delivered";
    }

    await notifyAdmin(`New deal #${dealNumber}: ${product.title} — ${price} ₽`);

    res.json(deal);
  } catch (err) {
    logger.error(err, "Create deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal) { res.status(404).json({ message: "Not found" }); return; }
    if (deal.buyerId !== userId && deal.sellerId !== userId && !(req as any).isAdmin) {
      res.status(403).json({ message: "Forbidden" }); return;
    }

    const [product] = await db.select({ title: products.title, images: products.images }).from(products).where(eq(products.id, deal.productId)).limit(1);
    const [buyer] = await db.select({ id: users.id, username: users.username, avatar: users.avatar }).from(users).where(eq(users.id, deal.buyerId)).limit(1);
    const [seller] = await db.select({ id: users.id, username: users.username, avatar: users.avatar }).from(users).where(eq(users.id, deal.sellerId)).limit(1);

    res.json({ ...deal, product, buyer, seller });
  } catch (err) {
    logger.error(err, "Get deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/deliver", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal || deal.sellerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (deal.status !== "paid") { res.status(400).json({ message: "Invalid status" }); return; }

    const { deliveryData } = req.body;
    await db.update(deals).set({ status: "delivered", deliveryData, autoCompleteAt: Math.floor(Date.now() / 1000) + 86400 }).where(eq(deals.id, deal.id));

    res.json({ message: "Delivered" });
  } catch (err) {
    logger.error(err, "Deliver deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/confirm", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal || deal.buyerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (deal.status !== "delivered") { res.status(400).json({ message: "Invalid status" }); return; }

    await db.update(deals).set({ status: "completed", buyerConfirmed: true }).where(eq(deals.id, deal.id));

    const [seller] = await db.select().from(users).where(eq(users.id, deal.sellerId)).limit(1);
    const sellerAmount = parseFloat(deal.sellerAmount);
    await db.update(users).set({
      balance: (parseFloat(seller.balance) + sellerAmount).toFixed(2),
      totalSales: seller.totalSales + 1,
      totalVolume: (parseFloat(seller.totalVolume) + sellerAmount).toFixed(2),
    }).where(eq(users.id, deal.sellerId));

    const [buyer] = await db.select().from(users).where(eq(users.id, deal.buyerId)).limit(1);
    await db.update(users).set({
      frozenBalance: Math.max(0, parseFloat(buyer.frozenBalance) - parseFloat(deal.amount)).toFixed(2),
    }).where(eq(users.id, deal.buyerId));

    await db.insert(transactions).values({
      userId: deal.sellerId,
      type: "sale_revenue",
      amount: sellerAmount.toFixed(2),
      status: "completed",
      description: `Sale revenue for deal #${deal.dealNumber}`,
    });

    await db.update(products).set({
      soldCount: sql`${products.soldCount} + 1`,
    }).where(eq(products.id, deal.productId));

    res.json({ message: "Confirmed" });
  } catch (err) {
    logger.error(err, "Confirm deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/dispute", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal || deal.buyerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (!["paid", "delivered"].includes(deal.status)) { res.status(400).json({ message: "Invalid status" }); return; }

    const { reason } = req.body;
    await db.update(deals).set({ status: "disputed", disputeReason: reason }).where(eq(deals.id, deal.id));
    await notifyAdmin(`Dispute on deal #${deal.dealNumber}: ${reason}`);

    res.json({ message: "Disputed" });
  } catch (err) {
    logger.error(err, "Dispute deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/review", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal || deal.buyerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (deal.status !== "completed") { res.status(400).json({ message: "Deal not completed" }); return; }

    const existing = await db.select().from(reviews).where(eq(reviews.dealId, deal.id)).limit(1);
    if (existing.length > 0) { res.status(400).json({ message: "Already reviewed" }); return; }

    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) { res.status(400).json({ message: "Invalid rating" }); return; }

    const [review] = await db.insert(reviews).values({
      dealId: deal.id,
      reviewerId: userId,
      sellerId: deal.sellerId,
      rating,
      comment,
    }).returning();

    const sellerReviews = await db.select({ rating: reviews.rating }).from(reviews).where(eq(reviews.sellerId, deal.sellerId));
    const avgRating = sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length;
    await db.update(users).set({
      rating: avgRating.toFixed(1),
      reviewCount: sellerReviews.length,
    }).where(eq(users.id, deal.sellerId));

    res.json(review);
  } catch (err) {
    logger.error(err, "Leave review error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
