import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Shop redact webhook.
 * Shopify sends this 48 hours after an app is uninstalled.
 * Public apps are required to redact/delete all data related to the store.
 */
export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for shop: ${shop}`);

  if (shop) {
    try {
      await Promise.all([
        db.session.deleteMany({ where: { shop } }),
        db.storeGoogleConnection.deleteMany({ where: { shop } }),
        db.storePlan.deleteMany({ where: { shop } }),
        db.sheetTab.deleteMany({ where: { shop } }),
        db.syncJob.deleteMany({ where: { shop } }),
      ]);
      console.log(`Successfully redacted and deleted all records for store: ${shop}`);
    } catch (err) {
      console.warn(`Error during shop redaction for ${shop}:`, err.message);
    }
  }

  return Response.json({ success: true });
};
