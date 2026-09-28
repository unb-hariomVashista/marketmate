import { authenticate } from "../shopify.server";

/**
 * Customers redact webhook.
 * Shopify sends this when a customer requests their data be erased/redacted.
 * Apps must process this within 48 hours. MarketMate holds no customer personal data.
 */
export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);

  // MarketMate does not store customer-specific data.
  // Return 200 OK to acknowledge compliance.
  return Response.json({ success: true, redacted: true, customerId: payload?.customer?.id });
};
