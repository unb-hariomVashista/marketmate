import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  if (shop) {
    await Promise.all([
      db.session.deleteMany({ where: { shop } }),
      db.storeGoogleConnection.deleteMany({ where: { shop } }),
    ]).catch((err) => {
      console.warn("Cleanup warning during app uninstall:", err.message);
    });
  }

  return new Response();
};
