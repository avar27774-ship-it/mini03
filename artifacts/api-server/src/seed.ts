import { db } from "@workspace/db";
import { categories, users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const defaultCategories = [
  { name: "Игровые аккаунты", slug: "game-accounts", icon: "Gamepad2", sortOrder: 1 },
  { name: "Игровые предметы", slug: "game-items", icon: "Swords", sortOrder: 2 },
  { name: "Игровая валюта", slug: "game-currency", icon: "Coins", sortOrder: 3 },
  { name: "Бустинг", slug: "boosting", icon: "Rocket", sortOrder: 4 },
  { name: "Услуги", slug: "services", icon: "Crown", sortOrder: 5 },
  { name: "Другое", slug: "other", icon: "ShoppingBag", sortOrder: 6 },
];

export async function seed() {
  for (const cat of defaultCategories) {
    const existing = await db.select().from(categories).where(eq(categories.slug, cat.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(categories).values(cat);
    }
  }

  const adminExists = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
  if (adminExists.length === 0) {
    const password = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      username: "admin",
      password,
      isAdmin: true,
      isVerified: true,
      refCode: "ADMIN001",
    });
  }

  console.log("Seed completed");
}
