import prisma from "../db.server";
import { PLAN_STANDARD, PLAN_PRO } from "../shopify.server";

export { PLAN_STANDARD, PLAN_PRO };

export const PLAN_LIMITS = {
  standard: {
    name: PLAN_STANDARD,
    price: 11,
    maxLocations: 3,
    maxMarkets: 3,
  },
  pro: {
    name: PLAN_PRO,
    price: 22,
    maxLocations: Infinity,
    maxMarkets: Infinity,
  },
  // Backward compatibility aliases
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
 */
export async function setStorePlan(shop, planKey, chargeId = null) {
  const normalizedKey = planKey?.toLowerCase() === "pro" ? "pro" : "standard";
  return prisma.storePlan.upsert({
    where: { shop },
    update: { plan: normalizedKey, status: "ACTIVE", chargeId },
    create: { shop, plan: normalizedKey, status: "ACTIVE", chargeId },
  });
}

export const isBillingTestMode = () =>
  process.env.SHOPIFY_BILLING_TEST !== "false";

/**
 * Retrieves the store's current subscription plan.
 * Checks Shopify Billing API first, falling back to database records.
 */
export async function getStorePlan(shop, billing = null) {
  if (billing) {
    try {
      const billingCheck = await billing.check({
        plans: [PLAN_STANDARD, PLAN_PRO],
        isTest: isBillingTestMode(),
      });

      if (billingCheck.hasActivePayment && billingCheck.appSubscriptions?.length > 0) {
        const activeSub = billingCheck.appSubscriptions[0];
        const isPro = activeSub.name?.toLowerCase().includes("pro");
        const planKey = isPro ? "pro" : "standard";

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

  // Database lookup
  const record = await prisma.storePlan.findUnique({
    where: { shop },
  });

  const normalizedDbPlan = record?.plan?.toLowerCase();

  if (record && record.status === "ACTIVE" && (normalizedDbPlan === "pro" || normalizedDbPlan === "standard")) {
    const isPro = normalizedDbPlan === "pro";
    return {
      plan: normalizedDbPlan,
      name: isPro ? PLAN_PRO : PLAN_STANDARD,
      amount: isPro ? 22 : 11,
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
  const normalizedPlan = plan?.toLowerCase();

  // No active plan: there is no free tier
  if (!normalizedPlan) {
    const requiredPlan =
      (isInventory && locationsCount > 3) || (isPricing && marketsCount > 3)
        ? "pro"
        : "standard";

    return {
      allowed: false,
      reason: "NO_PLAN",
      requiredPlan,
      requiredPrice: requiredPlan === "pro" ? 22 : 11,
      message:
        "Active subscription required. MarketMate does not offer a free tier. Please choose the $11 Standard Plan or $22 Pro Plan.",
    };
  }

  // If on Pro plan ($22/mo), everything is unlocked
  if (normalizedPlan === "pro") {
    return {
      allowed: true,
      reason: "PRO_UNLIMITED",
      requiredPlan: "pro",
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
        requiredPlan: "pro",
        requiredPrice: 22,
        message: `Your store has ${locationsCount} locations. Inventory sync for stores with more than 3 locations requires the Pro Plan ($22/mo).`,
      };
    }

    return {
      allowed: true,
      reason: "WITHIN_LIMITS",
      requiredPlan: "standard",
      requiredPrice: 11,
      message: `Standard Plan active (${locationsCount}/3 locations used).`,
    };
  }

  if (isPricing) {
    if (marketsCount > 3) {
      return {
        allowed: false,
        reason: "MARKET_LIMIT_EXCEEDED",
        requiredPlan: "pro",
        requiredPrice: 22,
        message: `Your store has ${marketsCount} markets. Pricing sync for stores with more than 3 markets requires the Pro Plan ($22/mo).`,
      };
    }

    return {
      allowed: true,
      reason: "WITHIN_LIMITS",
      requiredPlan: "standard",
      requiredPrice: 11,
      message: `Standard Plan active (${marketsCount}/3 markets used).`,
    };
  }

  return { allowed: true };
}
