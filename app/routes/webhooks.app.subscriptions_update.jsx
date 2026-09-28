import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const subscription = payload?.app_subscription;
  if (!shop || !subscription) {
    return new Response();
  }

  const rawStatus = (subscription.status || "").toUpperCase();
  const planName = subscription.name || "";
  const isPro = planName.toLowerCase().includes("pro");
  const planKey = isPro ? "pro" : "standard";
  const chargeId = subscription.admin_graphql_api_id || null;

  console.log(
    `[Billing Webhook] Store: ${shop} | Plan: ${planName} (${planKey}) | Status: ${rawStatus}`
  );

  try {
    if (rawStatus === "ACTIVE") {
      await db.storePlan.upsert({
        where: { shop },
        update: {
          plan: planKey,
          status: "ACTIVE",
          chargeId,
        },
        create: {
          shop,
          plan: planKey,
          status: "ACTIVE",
          chargeId,
        },
      });
    } else if (
      rawStatus === "CANCELLED" ||
      rawStatus === "EXPIRED" ||
      rawStatus === "DECLINED" ||
      rawStatus === "FROZEN"
    ) {
      await db.storePlan.updateMany({
        where: { shop },
        data: {
          status: rawStatus === "FROZEN" ? "FROZEN" : "CANCELLED",
        },
      });
    }
  } catch (err) {
    console.error(`[Billing Webhook] Error updating store plan for ${shop}:`, err.message);
  }

  return new Response();
};
