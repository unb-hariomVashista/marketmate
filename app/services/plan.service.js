import prisma from "../db.server";
import { PLAN_STANDARD, PLAN_PRO } from "../shopify.server";

export { PLAN_STANDARD, PLAN_PRO };

export const PLAN_LIMITS = {
  STANDARD: {
    name: PLAN_STANDARD,
    price: 11,
    maxLocations: 3,
    maxMarkets: 3,
  },
  PRO: {
    name: PLAN_PRO,
    price: 22,
    maxLocations: Infinity,
    maxMarkets: Infinity,
  },
};

/**
 * Updates or sets the store's current plan in DB.
 * Uses Prisma Client model if available, falling back to raw SQLite query.
 */
export async function setStorePlan(shop, planKey, chargeId = null) {
  if (prisma.storePlan) {
    return await prisma.storePlan.upsert({
      where: { shop },
      update: { plan: planKey, status: "ACTIVE", chargeId },
      create: { shop, plan: planKey, status: "ACTIVE", chargeId },
    });
  }

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO StorePlan (id, shop, plan, chargeId, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
       ON CONFLICT(shop) DO UPDATE SET plan = ?, chargeId = ?, status = 'ACTIVE', updatedAt = ?`,
      id,
      shop,
      planKey,
      chargeId,
      now,
      now,
      planKey,
      chargeId,
      now
    );
  } catch (err) {
    console.warn("StorePlan execute fallback warning:", err.message);
  }
}

/**
 * Retrieves the store's current subscription plan.
 * Checks Shopify Billing API first, falling back to database records.
 */
export async function getStorePlan(shop, billing = null) {
  if (billing) {
    try {
      const billingCheck = await billing.check({
        plans: [PLAN_STANDARD, PLAN_PRO],
        isTest: true,
      });

      if (billingCheck.hasActivePayment && billingCheck.appSubscriptions?.length > 0) {
        const activeSub = billingCheck.appSubscriptions[0];
        const isPro = activeSub.name?.toLowerCase().includes("pro");
        const planKey = isPro ? "PRO" : "STANDARD";

        await setStorePlan(shop, planKey, activeSub.id);

        return {
          plan: planKey,
          name: isPro ? PLAN_PRO : PLAN_STANDARD,
          amount: isPro ? 22 : 11,
          hasActivePayment: true,
        };
      }
    } catch (err) {
      console.warn("Shopify billing check warning:", err.message);
    }
  }

  // Database lookup (safe against Prisma client cache mismatch)
  let record = null;
  if (prisma.storePlan) {
    record = await prisma.storePlan.findUnique({
      where: { shop },
    });
  } else {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM StorePlan WHERE shop = ? LIMIT 1`,
        shop
      );
      record = rows && rows[0] ? rows[0] : null;
    } catch (err) {
      console.warn("StorePlan query fallback warning:", err.message);
    }
  }

  if (record && record.status === "ACTIVE" && (record.plan === "PRO" || record.plan === "STANDARD")) {
    return {
      plan: record.plan,
      name: record.plan === "PRO" ? PLAN_PRO : PLAN_STANDARD,
      amount: record.plan === "PRO" ? 22 : 11,
      hasActivePayment: true,
    };
  }

  return {
    plan: null,
    name: null,
    amount: 0,
    hasActivePayment: false,
  };
}

/**
 * Validates whether the store can use a specific functionality (INVENTORY or PRICING)
 * based on their current plan and location/market counts.
 */
export function checkFeatureAccess({ plan, type, locationsCount = 0, marketsCount = 0 }) {
  const isInventory = type === "INVENTORY";
  const isPricing = type === "PRICING";

  // No active plan: there is no free tier
  if (!plan) {
    const requiredPlan =
      (isInventory && locationsCount > 3) || (isPricing && marketsCount > 3)
        ? "PRO"
        : "STANDARD";

    return {
      allowed: false,
      reason: "NO_PLAN",
      requiredPlan,
      requiredPrice: requiredPlan === "PRO" ? 22 : 11,
      message:
        "Active subscription required. MarketMate does not offer a free tier. Please choose the $11 Standard Plan or $22 Pro Plan.",
    };
  }

  // If on Pro plan ($22/mo), everything is unlocked
  if (plan === "PRO") {
    return {
      allowed: true,
      reason: "PRO_UNLIMITED",
      requiredPlan: "PRO",
      requiredPrice: 22,
      message: "Pro Plan active (Unlimited locations & markets).",
    };
  }

  // If on Standard plan ($11/mo):
  // Up to 3 locations and up to 3 markets are allowed.
  // If locations > 3, inventory sync requires Pro ($22).
  // If markets > 3, pricing sync requires Pro ($22).
  if (isInventory) {
    if (locationsCount > 3) {
      return {
        allowed: false,
        reason: "LOCATION_LIMIT_EXCEEDED",
        requiredPlan: "PRO",
        requiredPrice: 22,
        message: `Your store has ${locationsCount} locations. Inventory sync for stores with more than 3 locations requires the Pro Plan ($22/mo).`,
      };
    }

    return {
      allowed: true,
      reason: "WITHIN_LIMITS",
      requiredPlan: "STANDARD",
      requiredPrice: 11,
      message: `Standard Plan active (${locationsCount}/3 locations used).`,
    };
  }

  if (isPricing) {
    if (marketsCount > 3) {
      return {
        allowed: false,
        reason: "MARKET_LIMIT_EXCEEDED",
        requiredPlan: "PRO",
        requiredPrice: 22,
        message: `Your store has ${marketsCount} markets. Pricing sync for stores with more than 3 markets requires the Pro Plan ($22/mo).`,
      };
    }

    return {
      allowed: true,
      reason: "WITHIN_LIMITS",
      requiredPlan: "STANDARD",
      requiredPrice: 11,
      message: `Standard Plan active (${marketsCount}/3 markets used).`,
    };
  }

  return { allowed: true };
}
