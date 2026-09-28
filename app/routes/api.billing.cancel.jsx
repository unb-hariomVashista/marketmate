import { authenticate } from "../shopify.server";
import { PLAN_STANDARD, PLAN_PRO, isBillingTestMode } from "../services/plan.service";
import db from "../db.server";

export const action = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const billingCheck = await billing.check({
      plans: [PLAN_STANDARD, PLAN_PRO],
      isTest: isBillingTestMode(),
    });

    const activeSub = billingCheck.appSubscriptions?.[0];
    if (activeSub?.id) {
      await billing.cancel({
        subscriptionId: activeSub.id,
        isTest: isBillingTestMode(),
        prorate: true,
      });
    }

    await db.storePlan.updateMany({
      where: { shop },
      data: { status: "CANCELLED" },
    });

    return Response.json({ success: true, message: "Subscription cancelled successfully." });
  } catch (error) {
    console.error(`[Billing Cancel] Error cancelling subscription for ${shop}:`, error);
    return Response.json(
      { error: error?.message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
};
