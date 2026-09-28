import { authenticate } from "../shopify.server";
import { PLAN_STANDARD, PLAN_PRO, isBillingTestMode } from "../services/plan.service";
import { getStoreMarketsAndLocations } from "../services/shopify/market.service";
import { getBillingReturnUrl } from "./app.plans";

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  let planKey = url.searchParams.get("plan");
  let returnTo = url.searchParams.get("returnTo") || "/app";

  // Also check request body if sent as JSON or form data
  if (!planKey) {
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await request.json();
        planKey = body.plan;
        returnTo = body.returnTo || returnTo;
      } else if (contentType.includes("form")) {
        const formData = await request.formData();
        planKey = formData.get("plan");
        returnTo = formData.get("returnTo") || returnTo;
      }
    } catch {
      // ignore parsing error, rely on URL params
    }
  }

  if (!planKey) {
    const storeData = await getStoreMarketsAndLocations(admin).catch(() => ({
      locations: [],
      markets: [],
    }));
    const requiresPro =
      (storeData.locations?.length || 0) > 3 ||
      (storeData.markets?.length || 0) > 3;
    planKey = requiresPro ? "pro" : "standard";
  }

  const normalizedKey = planKey?.toLowerCase() === "pro" ? "pro" : "standard";
  const planName = normalizedKey === "pro" ? PLAN_PRO : PLAN_STANDARD;
  const price = normalizedKey === "pro" ? 22 : 11;
  const returnUrl = getBillingReturnUrl(shop, returnTo);

  try {
    const response = await admin.graphql(
      `#graphql
      mutation appSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
        appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, test: $test) {
          confirmationUrl
          userErrors {
            field
            message
          }
          appSubscription {
            id
            status
          }
        }
      }`,
      {
        variables: {
          name: planName,
          returnUrl,
          test: isBillingTestMode(),
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: {
                    amount: price,
                    currencyCode: "USD",
                  },
                  interval: "EVERY_30_DAYS",
                },
              },
            },
          ],
        },
      }
    );

    const resJson = await response.json();
    const data = resJson?.data?.appSubscriptionCreate;

    if (data?.userErrors && data.userErrors.length > 0) {
      console.error("Shopify billing mutation user errors:", data.userErrors);
      return Response.json(
        { error: data.userErrors.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    if (!data?.confirmationUrl) {
      console.error("No confirmationUrl returned from Shopify:", resJson);
      return Response.json(
        { error: "Shopify did not return a subscription confirmation URL." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      confirmationUrl: data.confirmationUrl,
      plan: normalizedKey,
    });
  } catch (error) {
    console.error("Error creating Shopify app subscription:", error);
    return Response.json(
      { error: error?.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
};

export const loader = async ({ request }) => {
  // Allow GET requests to also trigger the action logic
  return action({ request });
};
