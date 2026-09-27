import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload?.current;
  const scopeString = Array.isArray(current) ? current.join(",") : current ? current.toString() : "";

  if (shop && scopeString) {
    await db.session.updateMany({
      where: { shop },
      data: { scope: scopeString },
    });
  }

  return new Response();
};
