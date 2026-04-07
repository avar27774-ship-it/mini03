import { Router } from "express";
import { db } from "@workspace/db";
import { users, products, deals, transactions, categories } from "@workspace/db/schema";
import { eq, desc, sql, ilike, and, gte } from "drizzle-orm";
import { authMiddleware, adminMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();
router.use(authMiddleware, adminMiddleware);

router.get("/stats", async (_req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);

    const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(users);
    const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`count(*)::int` }).from(products);
    const [{ totalDeals }] = await db.select({ totalDeals: sql<number>`count(*)::int` }).from(deals);
    const [{ totalRevenue }] = await db.select({ totalRevenue: sql<string>`coalesce(sum(commission::numeric), 0)::text` }).from(deals).where(eq(deals.status, "completed"));
    const [{ pendingWithdrawals }] = await db.select({ pendingWithdrawals: sql<number>`count(*)::int` }).from(transactions).where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "pending")));
    const [{ activeDisputes }] = await db.select({ activeDisputes: sql<number>`count(*)::int` }).from(deals).where(eq(deals.status, "disputed"));
    const [{ todayDeals }] = await db.select({ todayDeals: sql<number>`count(*)::int` }).from(deals).where(gte(deals.createdAt, todayStart));
    const [{ todayRegistrations }] = await db.select({ todayRegistrations: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, todayStart));

    res.json({ totalUsers, totalProducts, totalDeals, totalRevenue, pendingWithdrawals, activeDisputes, todayDeals, todayRegistrations });
  } catch (err) {
    logger.error(err, "Admin stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));

    let where;
    if (search) where = ilike(users.username, `%${search}%`);

    const usersList = await db.select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
      balance: users.balance,
      isAdmin: users.isAdmin,
      isVerified: users.isVerified,
      isBanned: users.isBanned,
      totalSales: users.totalSales,
      rating: users.rating,
      createdAt: users.createdAt,
    }).from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    res.json({ users: usersList });
  } catch (err) {
    logger.error(err, "Admin list users error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/users/:id/ban", async (req, res) => {
  try {
    const { banned } = req.body;
    await db.update(users).set({ isBanned: banned }).where(eq(users.id, req.params.id));
    res.json({ message: banned ? "Banned" : "Unbanned" });
  } catch (err) {
    logger.error(err, "Ban user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/users/:id/verify", async (req, res) => {
  try {
    await db.update(users).set({ isVerified: true }).where(eq(users.id, req.params.id));
    res.json({ message: "Verified" });
  } catch (err) {
    logger.error(err, "Verify user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const prods = await db.select({
      id: products.id,
      title: products.title,
      price: products.price,
      status: products.status,
      sellerId: products.sellerId,
      createdAt: products.createdAt,
      seller: { id: users.id, username: users.username },
    }).from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .orderBy(desc(products.createdAt))
      .limit(50);
    res.json({ products: prods });
  } catch (err) {
    logger.error(err, "Admin list products error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/products/:id/moderate", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "rejected", "hidden"].includes(status)) { res.status(400).json({ message: "Invalid status" }); return; }
    await db.update(products).set({ status }).where(eq(products.id, req.params.id));
    res.json({ message: "Moderated" });
  } catch (err) {
    logger.error(err, "Moderate product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/deals", async (req, res) => {
  try {
    const { status } = req.query as any;
    let where;
    if (status) where = eq(deals.status, status);

    const dealsList = await db.select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      amount: deals.amount,
      commission: deals.commission,
      status: deals.status,
      disputeReason: deals.disputeReason,
      createdAt: deals.createdAt,
      buyerId: deals.buyerId,
      sellerId: deals.sellerId,
    }).from(deals)
      .where(where)
      .orderBy(desc(deals.createdAt))
      .limit(50);

    const enriched = await Promise.all(dealsList.map(async (d) => {
      const [buyer] = await db.select({ username: users.username }).from(users).where(eq(users.id, d.buyerId)).limit(1);
      const [seller] = await db.select({ username: users.username }).from(users).where(eq(users.id, d.sellerId)).limit(1);
      return { ...d, buyer, seller };
    }));

    res.json({ deals: enriched });
  } catch (err) {
    logger.error(err, "Admin list deals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/deals/:id/resolve", async (req, res) => {
  try {
    const { resolution, adminComment } = req.body;
    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal) { res.status(404).json({ message: "Not found" }); return; }

    if (resolution === "refund_buyer") {
      await db.update(deals).set({ status: "refunded", adminComment }).where(eq(deals.id, deal.id));

      const [buyer] = await db.select().from(users).where(eq(users.id, deal.buyerId)).limit(1);
      const amount = parseFloat(deal.amount);
      await db.update(users).set({
        balance: (parseFloat(buyer.balance) + amount).toFixed(2),
        frozenBalance: Math.max(0, parseFloat(buyer.frozenBalance) - amount).toFixed(2),
      }).where(eq(users.id, deal.buyerId));

      await db.insert(transactions).values({
        userId: deal.buyerId,
        type: "refund",
        amount: deal.amount,
        status: "completed",
        description: `Refund for deal #${deal.dealNumber}`,
      });
    } else if (resolution === "pay_seller") {
      await db.update(deals).set({ status: "completed", adminComment }).where(eq(deals.id, deal.id));

      const [seller] = await db.select().from(users).where(eq(users.id, deal.sellerId)).limit(1);
      const sellerAmount = parseFloat(deal.sellerAmount);
      await db.update(users).set({
        balance: (parseFloat(seller.balance) + sellerAmount).toFixed(2),
        totalSales: seller.totalSales + 1,
      }).where(eq(users.id, deal.sellerId));

      const [buyer] = await db.select().from(users).where(eq(users.id, deal.buyerId)).limit(1);
      await db.update(users).set({
        frozenBalance: Math.max(0, parseFloat(buyer.frozenBalance) - parseFloat(deal.amount)).toFixed(2),
      }).where(eq(users.id, deal.buyerId));

      await db.insert(transactions).values({
        userId: deal.sellerId,
        type: "sale_revenue",
        amount: deal.sellerAmount,
        status: "completed",
        description: `Sale revenue for deal #${deal.dealNumber} (admin resolved)`,
      });
    }

    res.json({ message: "Resolved" });
  } catch (err) {
    logger.error(err, "Resolve deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/withdrawals", async (_req, res) => {
  try {
    const pending = await db.select({
      id: transactions.id,
      userId: transactions.userId,
      amount: transactions.amount,
      withdrawMethod: transactions.withdrawMethod,
      withdrawDetails: transactions.withdrawDetails,
      description: transactions.description,
      createdAt: transactions.createdAt,
    }).from(transactions)
      .where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "pending")))
      .orderBy(transactions.createdAt);
    res.json(pending);
  } catch (err) {
    logger.error(err, "Admin withdrawals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/withdrawals/:id/process", async (req, res) => {
  try {
    const { action } = req.body;
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, req.params.id)).limit(1);
    if (!tx || tx.status !== "pending") { res.status(400).json({ message: "Invalid" }); return; }

    if (action === "approve") {
      await db.update(transactions).set({ status: "completed" }).where(eq(transactions.id, tx.id));
      const [user] = await db.select().from(users).where(eq(users.id, tx.userId)).limit(1);
      await db.update(users).set({
        totalWithdrawn: (parseFloat(user.totalWithdrawn) + parseFloat(tx.amount)).toFixed(2),
      }).where(eq(users.id, tx.userId));
    } else if (action === "reject") {
      await db.update(transactions).set({ status: "cancelled" }).where(eq(transactions.id, tx.id));
      const [user] = await db.select().from(users).where(eq(users.id, tx.userId)).limit(1);
      await db.update(users).set({
        balance: (parseFloat(user.balance) + parseFloat(tx.amount)).toFixed(2),
      }).where(eq(users.id, tx.userId));
    }

    res.json({ message: `Withdrawal ${action}ed` });
  } catch (err) {
    logger.error(err, "Process withdrawal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, slug, icon, sortOrder } = req.body;
    if (!name || !slug) { res.status(400).json({ message: "Missing name/slug" }); return; }
    const [cat] = await db.insert(categories).values({ name, slug, icon, sortOrder: sortOrder || 0 }).returning();
    res.json(cat);
  } catch (err) {
    logger.error(err, "Create category error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const { name, slug, icon, sortOrder, isActive } = req.body;
    const [cat] = await db.update(categories).set({
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }).where(eq(categories.id, req.params.id)).returning();
    res.json(cat);
  } catch (err) {
    logger.error(err, "Update category error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    await db.delete(categories).where(eq(categories.id, req.params.id));
    res.json({ message: "Deleted" });
  } catch (err) {
    logger.error(err, "Delete category error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
