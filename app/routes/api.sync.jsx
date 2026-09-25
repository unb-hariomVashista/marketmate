import { authenticate } from "../shopify.server";
import { getGoogleAccountByShop } from "../repository/user.repository";
import { getSpreadsheetById } from "../repository/sheet.repository";
import { getActiveSyncJob } from "../repository/sync.repository";
import { getStoreMarketsAndLocations } from "../services/shopify/market.service";
import { getStorePlan, checkFeatureAccess } from "../services/plan.service";
import {
  exportInventoryToSheet,
  importInventoryFromSheet,
  exportPricingToSheet,
  importPricingFromSheet,
} from "../services/syncEngine.service";
import { readTabValues } from "../services/google/googleSheets.service";
import { fetchProductsWithInventory } from "../services/shopify/inventory.service";
import { fetchProductsWithPricing } from "../services/shopify/pricing.service";

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
    const { actionType, spreadsheetId, marketId, locationId, sourceTabTitle } = await request.json();

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

    // Plan Enforcement Guard
    const storePlan = await getStorePlan(shopDomain);
    const planAccess = checkFeatureAccess({
      plan: storePlan.plan,
      type: isInventoryAction ? "INVENTORY" : "PRICING",
      locationsCount: locations.length,
      marketsCount: markets.length,
    });

    if (!planAccess.allowed) {
      return Response.json(
        {
          error: planAccess.message,
          planAccess,
        },
        { status: 403 }
      );
    }

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
          locations,
          sourceTabTitle,
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
          sourceTabTitle,
        });
        break;

      case "PREVIEW_INVENTORY": {
        const defaultTab = `${shop.name || "Store"} - ${targetLocation.name} Inventory`.slice(0, 95);
        const tabTitle = sourceTabTitle || defaultTab;
        try {
          const { headers, rows } = await readTabValues({
            googleAccount,
            spreadsheetId: spreadsheet.spreadsheetId,
            tabTitle,
          });

          const skuColIndex = headers.findIndex((h) => h.trim().toUpperCase() === "SKU");
          const qtyColIndex = headers.findIndex(
            (h) =>
              h === "Available Quantity" ||
              h === "Quantity" ||
              h === "Qty" ||
              h.toLowerCase().includes("available") ||
              h.toLowerCase().includes("qty")
          );

          // Fetch current store variants to test SKU matching
          const currentVariants = await fetchProductsWithInventory(admin, [targetLocation.id]);
          const skuMap = new Map();
          for (const v of currentVariants) {
            if (v.sku && v.sku.trim()) {
              skuMap.set(v.sku.trim().toLowerCase(), v);
            }
          }
          const variantMap = new Map(currentVariants.map((v) => [v.variantId, v]));

          let skuMatchCount = 0;
          let gidMatchCount = 0;
          let unmatchedCount = 0;

          // Compute matching across ALL rows in the sheet for accurate summary
          for (const row of rows) {
            const rawVariantId = row[0]?.trim();
            const rawSku = skuColIndex !== -1 ? row[skuColIndex]?.toString().trim() : "";

            if (rawSku && skuMap.has(rawSku.toLowerCase())) {
              skuMatchCount++;
            } else if (rawVariantId && variantMap.has(rawVariantId)) {
              gidMatchCount++;
            } else {
              unmatchedCount++;
            }
          }

          const previewRows = rows.slice(0, 20).map((row) => {
            const rawVariantId = row[0]?.trim();
            const rawSku = skuColIndex !== -1 ? row[skuColIndex]?.toString().trim() : "";
            const rawTitle = row[3]?.toString().trim() || "";
            const incomingQty = qtyColIndex !== -1 ? row[qtyColIndex] : "-";

            let matched = null;
            let matchType = null;

            if (rawSku && skuMap.has(rawSku.toLowerCase())) {
              matched = skuMap.get(rawSku.toLowerCase());
              matchType = "SKU";
            } else if (rawVariantId && variantMap.has(rawVariantId)) {
              matched = variantMap.get(rawVariantId);
              matchType = "VARIANT_ID";
            }

            const currentQty = matched ? (matched.quantitiesByLocation[targetLocation.id] ?? 0) : "-";

            return [
              matched?.variantId || rawVariantId || "-",
              rawSku || (matched?.sku ?? "-"),
              matched?.productTitle || rawTitle || "Unknown",
              `${matched ? "Matched by " + matchType : "Not found in store"} • Incoming: ${incomingQty} | Current: ${currentQty}`,
            ];
          });

          result = {
            preview: {
              headers: ["Target Store Variant ID", "SKU", "Product Title", "Sync Diff Preview"],
              rows: previewRows,
              totalRows: rows.length,
              tabTitle,
              summary: {
                totalInSheet: rows.length,
                matchedBySku: skuMatchCount,
                matchedByGid: gidMatchCount,
                unmatched: unmatchedCount,
                isCrossStore: skuMatchCount > 0 && gidMatchCount === 0,
              },
            },
          };
        } catch (err) {
          result = {
            preview: {
              headers: [],
              rows: [],
              totalRows: 0,
              tabTitle,
              error: err.message,
            },
          };
        }
        return Response.json({ success: true, ...result });
      }

      case "PREVIEW_PRICING": {
        const defaultTab = `${shop.name || "Store"} - ${targetMarket.name} Pricing`.slice(0, 95);
        const tabTitle = sourceTabTitle || defaultTab;
        try {
          const { headers, rows } = await readTabValues({
            googleAccount,
            spreadsheetId: spreadsheet.spreadsheetId,
            tabTitle,
          });

          const skuColIndex = headers.findIndex((h) => h.trim().toUpperCase() === "SKU");
          let priceColIndex = headers.findIndex((h) =>
            h.toLowerCase().includes("market price")
          );
          if (priceColIndex === -1) {
            priceColIndex = headers.findIndex((h) =>
              h.toLowerCase().includes("price") && !h.toLowerCase().includes("compare")
            );
          }

          // Fetch current store variants for pricing
          const currentVariants = await fetchProductsWithPricing(admin, {
            countryCode: targetMarket.primaryCountryCode,
            marketId: targetMarket.id,
            priceListId: targetMarket.priceListId,
          });

          const skuMap = new Map();
          for (const v of currentVariants) {
            if (v.sku && v.sku.trim()) {
              skuMap.set(v.sku.trim().toLowerCase(), v);
            }
          }
          const variantMap = new Map(currentVariants.map((v) => [v.variantId, v]));

          let skuMatchCount = 0;
          let gidMatchCount = 0;
          let unmatchedCount = 0;

          // Compute matching across ALL rows in the sheet for accurate summary
          for (const row of rows) {
            const rawVariantId = row[0]?.trim();
            const rawSku = skuColIndex !== -1 ? row[skuColIndex]?.toString().trim() : "";

            if (rawSku && skuMap.has(rawSku.toLowerCase())) {
              skuMatchCount++;
            } else if (rawVariantId && variantMap.has(rawVariantId)) {
              gidMatchCount++;
            } else {
              unmatchedCount++;
            }
          }

          const previewRows = rows.slice(0, 20).map((row) => {
            const rawVariantId = row[0]?.trim();
            const rawSku = skuColIndex !== -1 ? row[skuColIndex]?.toString().trim() : "";
            const rawTitle = row[3]?.toString().trim() || "";
            const incomingPrice = priceColIndex !== -1 ? row[priceColIndex] : "-";

            let matched = null;
            let matchType = null;

            if (rawSku && skuMap.has(rawSku.toLowerCase())) {
              matched = skuMap.get(rawSku.toLowerCase());
              matchType = "SKU";
            } else if (rawVariantId && variantMap.has(rawVariantId)) {
              matched = variantMap.get(rawVariantId);
              matchType = "VARIANT_ID";
            }

            const currentPrice = matched ? (matched.marketPrice || matched.price || "-") : "-";

            return [
              matched?.variantId || rawVariantId || "-",
              rawSku || (matched?.sku ?? "-"),
              matched?.productTitle || rawTitle || "Unknown",
              `${matched ? "Matched by " + matchType : "Not found in store"} • Incoming: ${incomingPrice} | Current: ${currentPrice}`,
            ];
          });

          result = {
            preview: {
              headers: ["Target Store Variant ID", "SKU", "Product Title", "Sync Diff Preview"],
              rows: previewRows,
              totalRows: rows.length,
              tabTitle,
              summary: {
                totalInSheet: rows.length,
                matchedBySku: skuMatchCount,
                matchedByGid: gidMatchCount,
                unmatched: unmatchedCount,
                isCrossStore: skuMatchCount > 0 && gidMatchCount === 0,
              },
            },
          };
        } catch (err) {
          result = {
            preview: {
              headers: [],
              rows: [],
              totalRows: 0,
              tabTitle,
              error: err.message,
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
