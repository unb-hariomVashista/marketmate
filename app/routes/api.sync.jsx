import { authenticate } from "../shopify.server";
import { getGoogleAccountByShop } from "../repository/user.repository";
import { getSpreadsheetById } from "../repository/sheet.repository";
import { getActiveSyncJob } from "../repository/sync.repository";
import { getStoreMarketsAndLocations } from "../services/shopify/market.service";
import {
  exportInventoryToSheet,
  importInventoryFromSheet,
  exportPricingToSheet,
  importPricingFromSheet,
} from "../services/syncEngine.service";
import { readTabValues } from "../services/google/googleSheets.service";

/**
 * POST /api/sync
 * Body: { actionType: "EXPORT_INVENTORY" | "IMPORT_INVENTORY" | "EXPORT_PRICING" | "IMPORT_PRICING", spreadsheetId, marketId }
 */
export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const googleAccount = await getGoogleAccountByShop(shopDomain);
  if (!googleAccount) {
    return Response.json(
      { error: "Google account not connected to this store." },
      { status: 401 }
    );
  }

  try {
    const { actionType, spreadsheetId, marketId, locationId } = await request.json();

    const entityId = locationId || marketId;
    if (!actionType || !spreadsheetId || !entityId) {
      return Response.json(
        { error: "actionType, spreadsheetId, and marketId/locationId are required." },
        { status: 400 }
      );
    }

    // 1. Concurrency Guard: Check if another job is in progress
    const activeJob = await getActiveSyncJob({
      spreadsheetId,
      shop: shopDomain,
      marketId: entityId,
    });

    if (activeJob) {
      return Response.json(
        {
          error: "A sync job is already in progress for this item. Please wait a moment.",
          inProgress: true,
        },
        { status: 409 }
      );
    }

    // 2. Fetch Spreadsheet from DB
    const spreadsheet = await getSpreadsheetById(spreadsheetId);
    if (!spreadsheet) {
      return Response.json({ error: "Spreadsheet not found." }, { status: 404 });
    }

    // 3. Fetch store markets and locations from Shopify
    const { shop, markets, locations } = await getStoreMarketsAndLocations(admin);
    const isInventoryAction = actionType.includes("INVENTORY");

    const targetLocation = isInventoryAction
      ? locations.find((l) => l.id === entityId) || locations[0]
      : null;

    const targetMarket = !isInventoryAction
      ? markets.find((m) => m.id === entityId)
      : null;

    if (isInventoryAction && !targetLocation) {
      return Response.json(
        { error: `Location/Warehouse with ID "${entityId}" not found in Shopify store.` },
        { status: 404 }
      );
    }

    if (!isInventoryAction && !targetMarket) {
      return Response.json(
        { error: `Market with ID "${entityId}" was not found in Shopify store.` },
        { status: 404 }
      );
    }

    // 4. Dispatch sync action
    let result;
    switch (actionType) {
      case "EXPORT_INVENTORY":
        result = await exportInventoryToSheet({
          admin,
          shop,
          googleAccount,
          spreadsheet,
          location: targetLocation,
        });
        break;

      case "IMPORT_INVENTORY":
        result = await importInventoryFromSheet({
          admin,
          shop,
          googleAccount,
          spreadsheet,
          location: targetLocation,
        });
        break;

      case "EXPORT_PRICING":
        result = await exportPricingToSheet({
          admin,
          shop,
          googleAccount,
          spreadsheet,
          market: targetMarket,
        });
        break;

      case "IMPORT_PRICING":
        result = await importPricingFromSheet({
          admin,
          shop,
          googleAccount,
          spreadsheet,
          market: targetMarket,
        });
        break;

      case "PREVIEW_INVENTORY": {
        const tabTitle = `${shop.name || "Store"} - ${targetLocation.name} Inventory`.slice(0, 95);
        try {
          const { headers, rows } = await readTabValues({
            googleAccount,
            spreadsheetId: spreadsheet.spreadsheetId,
            tabTitle,
          });
          result = {
            preview: {
              headers,
              rows: rows.slice(0, 10),
              totalRows: rows.length,
              tabTitle,
            },
          };
        } catch {
          result = {
            preview: {
              headers: [],
              rows: [],
              totalRows: 0,
              tabTitle,
            },
          };
        }
        return Response.json({ success: true, ...result });
      }

      case "PREVIEW_PRICING": {
        const tabTitle = `${shop.name || "Store"} - ${targetMarket.name} Pricing`.slice(0, 95);
        try {
          const { headers, rows } = await readTabValues({
            googleAccount,
            spreadsheetId: spreadsheet.spreadsheetId,
            tabTitle,
          });
          result = {
            preview: {
              headers,
              rows: rows.slice(0, 10),
              totalRows: rows.length,
              tabTitle,
            },
          };
        } catch {
          result = {
            preview: {
              headers: [],
              rows: [],
              totalRows: 0,
              tabTitle,
            },
          };
        }
        return Response.json({ success: true, ...result });
      }

      default:
        return Response.json(
          { error: `Unknown actionType: ${actionType}` },
          { status: 400 }
        );
    }

    return Response.json({ success: true, result });
  } catch (error) {
    console.error("Sync API execution error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
