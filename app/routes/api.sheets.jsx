import { authenticate } from "../shopify.server";
import { getGoogleAccountByShop } from "../repository/user.repository";
import {
  getSheetsByGoogleAccountId,
  upsertSpreadsheet,
  deleteSpreadsheet,
} from "../repository/sheet.repository";
import { createSpreadsheet } from "../services/google/googleSheets.service";

/**
 * GET /api/sheets?type=INVENTORY|PRICING
 */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const googleAccount = await getGoogleAccountByShop(shop);
  if (!googleAccount) {
    return Response.json({ error: "Google account not connected" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  const sheets = await getSheetsByGoogleAccountId(googleAccount.id, type);
  return Response.json({ sheets });
};

/**
 * POST /api/sheets
 * Body: { title, type: "INVENTORY" | "PRICING" }
 */
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const googleAccount = await getGoogleAccountByShop(shop);
  if (!googleAccount) {
    return Response.json({ error: "Google account not connected" }, { status: 401 });
  }

  if (request.method === "POST") {
    try {
      const { title, type } = await request.json();

      if (!title || !type) {
        return Response.json(
          { error: "Title and type (INVENTORY or PRICING) are required" },
          { status: 400 }
        );
      }

      // 1. Create on Google Drive
      const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet({
        googleAccount,
        title,
        initialTabTitle: `${type} Overview`,
      });

      // 2. Persist in database
      const newSheet = await upsertSpreadsheet({
        googleAccountId: googleAccount.id,
        spreadsheetId,
        spreadsheetUrl,
        title,
        type,
      });

      return Response.json({ success: true, sheet: newSheet });
    } catch (error) {
      console.error("Error creating Google Sheet:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    try {
      const { id } = await request.json();
      await deleteSpreadsheet(id);
      return Response.json({ success: true });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return Response.json({ error: `Method ${request.method} Not Allowed` }, { status: 405 });
};
