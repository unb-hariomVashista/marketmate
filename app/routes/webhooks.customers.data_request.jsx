import { authenticate } from "../shopify.server";

/**
 * Customers data request webhook.
 * Shopify sends this when a merchant or customer requests a copy of customer data held by the app.
 * MarketMate stores multi-market pricing and location inventory, and holds no personal customer data.
 */
export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);

  // MarketMate does not store customer-specific data.
  // Return 200 OK to acknowledge receipt.
  return Response.json({ success: true, customerData: null, shop, customerId: payload?.customer?.id });
};
