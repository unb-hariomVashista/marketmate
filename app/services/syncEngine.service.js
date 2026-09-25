import {
  ensureTabExists,
  protectColumnA,
  writeTabValues,
  readTabValues,
} from "./google/googleSheets.service";
import {
  fetchProductsWithInventory,
  batchUpdateInventoryQuantities,
} from "./shopify/inventory.service";
import {
  fetchProductsWithPricing,
  batchUpdatePriceList,
  batchUpdateBaseVariantPrices,
  ensureMarketPriceList,
} from "./shopify/pricing.service";
import { upsertSheetTab, updateTabLastSynced } from "../repository/sheet.repository";
import { createSyncJob, updateSyncJob } from "../repository/sync.repository";

/**
 * EXPORT: Shopify Inventory -> Google Sheet tab (by Warehouse / Location)
 */
export async function exportInventoryToSheet({
  admin,
  shop,
  googleAccount,
  spreadsheet,
  location,
  market: _market = null,
  locations = [],
}) {
  const targetLocation = location || locations[0];
  if (!targetLocation) {
    throw new Error("No location provided for inventory export.");
  }

  const syncJob = await createSyncJob({
    spreadsheetId: spreadsheet.id,
    shop: shop.myshopifyDomain,
    marketId: targetLocation.id,
    type: "INVENTORY",
    direction: "SHOPIFY_TO_SHEET",
  });

  try {
    const tabTitle = `${shop.name || "Store"} - ${targetLocation.name} Inventory`.slice(0, 95);

    // 1. Ensure tab exists and get sheetId
    const { sheetId } = await ensureTabExists({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      tabTitle,
    });

    // 2. Protect column A (Shopify Variant GID)
    await protectColumnA({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      sheetId,
    });

    // 3. Fetch products and inventory for this warehouse
    const variants = await fetchProductsWithInventory(admin, [targetLocation.id]);

    // 4. Construct headers
    const headers = [
      "Shopify Variant ID",
      "SKU",
      "Barcode",
      "Product Title",
      "Variant Title",
      "Available Quantity",
    ];

    // 5. Construct rows
    const rows = variants.map((v) => [
      v.variantId,
      v.sku,
      v.barcode,
      v.productTitle,
      v.variantTitle,
      v.quantitiesByLocation[targetLocation.id] ?? 0,
    ]);

    // 6. Batch write to sheet
    await writeTabValues({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      tabTitle,
      headers,
      rows,
    });

    // 7. Upsert tab in DB
    const tab = await upsertSheetTab({
      spreadsheetId: spreadsheet.id,
      shop: shop.myshopifyDomain,
      marketId: targetLocation.id,
      marketName: targetLocation.name,
      tabTitle,
      tabGid: sheetId,
    });
    await updateTabLastSynced(tab.id);

    // 8. Update sync job
    await updateSyncJob(syncJob.id, {
      status: "SUCCESS",
      summary: `Exported ${variants.length} variants for warehouse "${targetLocation.name}" to tab "${tabTitle}".`,
      completed: true,
    });

    return { success: true, tabTitle, rowCount: variants.length };
  } catch (error) {
    console.error("Export inventory error:", error);
    await updateSyncJob(syncJob.id, {
      status: "FAILED",
      errorLogs: error.message,
      completed: true,
    });
    throw error;
  }
}

/**
 * IMPORT: Google Sheet tab -> Shopify Inventory (by Warehouse / Location)
 */
export async function importInventoryFromSheet({
  admin,
  shop,
  googleAccount,
  spreadsheet,
  location,
  market: _market = null,
  locations = [],
  sourceTabTitle = null,
}) {
  const targetLocation = location || locations[0];
  if (!targetLocation) {
    throw new Error("No location provided for inventory import.");
  }

  const syncJob = await createSyncJob({
    spreadsheetId: spreadsheet.id,
    shop: shop.myshopifyDomain,
    marketId: targetLocation.id,
    type: "INVENTORY",
    direction: "SHEET_TO_SHOPIFY",
  });

  try {
    const defaultTabTitle = `${shop.name || "Store"} - ${targetLocation.name} Inventory`.slice(0, 95);
    const tabTitle = sourceTabTitle || defaultTabTitle;

    // 1. Read sheet data
    const { headers, rows } = await readTabValues({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      tabTitle,
    });

    if (rows.length === 0) {
      throw new Error(`Sheet tab "${tabTitle}" is empty or has no data rows.`);
    }

    // Map column headers: support "SKU", "Available Quantity", "Quantity", or "[Location] (Qty)"
    const skuColIndex = headers.findIndex((h) => h.trim().toUpperCase() === "SKU");
    const _barcodeColIndex = headers.findIndex((h) => h.trim().toUpperCase() === "BARCODE");

    let qtyColIndex = headers.findIndex(
      (h) =>
        h === "Available Quantity" ||
        h === "Quantity" ||
        h === "Qty" ||
        h.toLowerCase().includes("available") ||
        h.toLowerCase().includes("qty")
    );

    if (qtyColIndex === -1) {
      const locHeader = `${targetLocation.name} (Qty)`;
      qtyColIndex = headers.indexOf(locHeader);
    }

    if (qtyColIndex === -1) {
      throw new Error(
        `Could not find an "Available Quantity" column in sheet tab "${tabTitle}". Headers found: ${headers.join(", ")}`
      );
    }

    // 2. Fetch current inventory of target store to match by SKU / Variant ID and compare diffs
    const queryLocations =
      locations && locations.length > 0 ? locations.map((l) => l.id) : [targetLocation.id];
    const currentVariants = await fetchProductsWithInventory(
      admin,
      queryLocations
    );

    // Primary: SKU lookup (cross-store mapping)
    const skuMap = new Map();
    for (const v of currentVariants) {
      if (v.sku && v.sku.trim()) {
        skuMap.set(v.sku.trim().toLowerCase(), v);
      }
    }
    // Fallback: Variant ID lookup (same-store mapping)
    const variantMap = new Map(currentVariants.map((v) => [v.variantId, v]));

    const quantitiesToUpdate = [];
    let matchedBySkuCount = 0;
    let matchedByGidCount = 0;
    let skippedCount = 0;
    let invalidCount = 0;

    for (const row of rows) {
      const rawVariantId = row[0]?.trim();
      const rawSku = skuColIndex !== -1 ? row[skuColIndex]?.toString().trim() : null;

      // Match by SKU first (handles cross-store syncing e.g. Store A -> Store B)
      let matchedVariant = null;
      let matchType = null;

      if (rawSku && skuMap.has(rawSku.toLowerCase())) {
        matchedVariant = skuMap.get(rawSku.toLowerCase());
        matchType = "SKU";
      } else if (rawVariantId && variantMap.has(rawVariantId)) {
        matchedVariant = variantMap.get(rawVariantId);
        matchType = "VARIANT_ID";
      }

      if (!matchedVariant || !matchedVariant.inventoryItemId) {
        skippedCount++;
        continue;
      }

      const rawQty = row[qtyColIndex];
      const newQty = parseInt(rawQty, 10);

      if (isNaN(newQty) || newQty < 0) {
        // invalid quantity row
        continue;
      }

      const currentQty = matchedVariant.quantitiesByLocation[targetLocation.id] ?? 0;
      // Diffing: only update if changed
      if (newQty !== currentQty) {
        quantitiesToUpdate.push({
          inventoryItemId: matchedVariant.inventoryItemId,
          locationId: targetLocation.id,
          quantity: newQty,
        });

        if (matchType === "SKU") matchedBySkuCount++;
        else matchedByGidCount++;
      } else {
        skippedCount++;
      }
    }

    // 3. Batch apply to Shopify
    const { successCount, errors } = await batchUpdateInventoryQuantities(
      admin,
      quantitiesToUpdate
    );

    const summary = `Synced from tab "${tabTitle}" into "${targetLocation.name}". Updated ${successCount} entries (${matchedBySkuCount} matched via SKU, ${matchedByGidCount} matched via Variant ID). Skipped ${skippedCount} unchanged/unmatched.`;

    await updateSyncJob(syncJob.id, {
      status: errors.length > 0 ? "PARTIAL_FAILED" : "SUCCESS",
      summary,
      errorLogs: errors.length > 0 ? errors.join("; ") : null,
      completed: true,
    });

    return { success: true, summary, errors, matchedBySkuCount, matchedByGidCount };
  } catch (error) {
    console.error("Import inventory error:", error);
    await updateSyncJob(syncJob.id, {
      status: "FAILED",
      errorLogs: error.message,
      completed: true,
    });
    throw error;
  }
}

/**
 * EXPORT: Shopify Pricing -> Google Sheet tab
 */
export async function exportPricingToSheet({
  admin,
  shop,
  googleAccount,
  spreadsheet,
  market,
}) {
  const syncJob = await createSyncJob({
    spreadsheetId: spreadsheet.id,
    shop: shop.myshopifyDomain,
    marketId: market.id,
    type: "PRICING",
    direction: "SHOPIFY_TO_SHEET",
  });

  try {
    const tabTitle = `${shop.name || "Store"} - ${market.name} Pricing`.slice(0, 95);

    // 1. Ensure tab exists and get sheetId
    const { sheetId } = await ensureTabExists({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      tabTitle,
    });

    // 2. Protect column A
    await protectColumnA({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      sheetId,
    });

    // 3. Fetch variants with base & market prices
    const variants = await fetchProductsWithPricing(admin, {
      countryCode: market.primaryCountryCode,
      marketId: market.id,
      priceListId: market.priceListId,
    });

    // 4. Construct headers
    const headers = [
      "Shopify Variant ID",
      "SKU",
      "Product Title",
      "Variant Title",
      `Base Price (${shop.currencyCode || "Base"})`,
      `Market Price (${market.currency})`,
      `Compare At Price (${market.currency})`,
    ];

    // 5. Construct rows
    const rows = variants.map((v) => [
      v.variantId,
      v.sku,
      v.productTitle,
      v.variantTitle,
      v.basePrice,
      v.marketPrice,
      v.compareAtPrice,
    ]);

    // 6. Batch write to sheet
    await writeTabValues({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      tabTitle,
      headers,
      rows,
    });

    // 7. Upsert tab in DB
    const tab = await upsertSheetTab({
      spreadsheetId: spreadsheet.id,
      shop: shop.myshopifyDomain,
      marketId: market.id,
      marketName: market.name,
      tabTitle,
      tabGid: sheetId,
    });
    await updateTabLastSynced(tab.id);

    // 8. Update sync job
    await updateSyncJob(syncJob.id, {
      status: "SUCCESS",
      summary: `Exported ${variants.length} products to tab "${tabTitle}" in currency ${market.currency}.`,
      completed: true,
    });

    return { success: true, tabTitle, rowCount: variants.length };
  } catch (error) {
    console.error("Export pricing error:", error);
    await updateSyncJob(syncJob.id, {
      status: "FAILED",
      errorLogs: error.message,
      completed: true,
    });
    throw error;
  }
}

/**
 * IMPORT: Google Sheet tab -> Shopify Pricing
 */
export async function importPricingFromSheet({
  admin,
  shop,
  googleAccount,
  spreadsheet,
  market,
  sourceTabTitle = null,
}) {
  const syncJob = await createSyncJob({
    spreadsheetId: spreadsheet.id,
    shop: shop.myshopifyDomain,
    marketId: market.id,
    type: "PRICING",
    direction: "SHEET_TO_SHOPIFY",
  });

  try {
    const defaultTabTitle = `${shop.name || "Store"} - ${market.name} Pricing`.slice(0, 95);
    const tabTitle = sourceTabTitle || defaultTabTitle;

    // 1. Read sheet data
    const { headers, rows } = await readTabValues({
      googleAccount,
      spreadsheetId: spreadsheet.spreadsheetId,
      tabTitle,
    });

    if (rows.length === 0) {
      throw new Error(`Sheet tab "${tabTitle}" is empty or has no data rows.`);
    }

    const skuColIndex = headers.findIndex((h) => h.trim().toUpperCase() === "SKU");
    const _barcodeColIndex = headers.findIndex((h) => h.trim().toUpperCase() === "BARCODE");
    
    // Prioritize "Market Price" over "Base Price" when both exist
    let priceColIndex = headers.findIndex((h) =>
      h.toLowerCase().includes("market price")
    );
    if (priceColIndex === -1) {
      priceColIndex = headers.findIndex((h) =>
        h.toLowerCase().includes("price") && !h.toLowerCase().includes("compare")
      );
    }
    const compareAtColIndex = headers.findIndex((h) =>
      h.toLowerCase().includes("compare")
    );

    if (priceColIndex === -1) {
      throw new Error(`Could not find a price column in sheet tab "${tabTitle}". Headers found: ${headers.join(", ")}`);
    }

    // 2. Fetch current prices in target store for diffing and matching
    const currentVariants = await fetchProductsWithPricing(admin, {
      countryCode: market.primaryCountryCode,
      marketId: market.id,
      priceListId: market.priceListId,
    });

    // Primary: SKU lookup (cross-store mapping!)
    const skuMap = new Map();
    for (const v of currentVariants) {
      if (v.sku && v.sku.trim()) {
        skuMap.set(v.sku.trim().toLowerCase(), v);
      }
    }
    // Fallback: Variant ID lookup (same-store mapping)
    const variantMap = new Map(currentVariants.map((v) => [v.variantId, v]));

    const pricesToAdd = [];
    let matchedBySkuCount = 0;
    let matchedByGidCount = 0;
    let skippedCount = 0;
    let invalidCount = 0;

    for (const row of rows) {
      const rawVariantId = row[0]?.trim();
      const rawSku = skuColIndex !== -1 ? row[skuColIndex]?.toString().trim() : null;

      // Match by SKU first (handles cross-store mapping e.g. Store A -> Store B)
      let matchedVariant = null;
      let matchType = null;

      if (rawSku && skuMap.has(rawSku.toLowerCase())) {
        matchedVariant = skuMap.get(rawSku.toLowerCase());
        matchType = "SKU";
      } else if (rawVariantId && variantMap.has(rawVariantId)) {
        matchedVariant = variantMap.get(rawVariantId);
        matchType = "VARIANT_ID";
      }

      if (!matchedVariant) {
        skippedCount++;
        continue;
      }

      const rawPrice = row[priceColIndex]?.toString().trim();
      const numPrice = parseFloat(rawPrice);

      if (isNaN(numPrice) || numPrice < 0) {
        // invalid price row
        continue;
      }

      // Diffing: check if price changed
      const priceChanged = parseFloat(matchedVariant.marketPrice) !== numPrice;
      const rawCompare = compareAtColIndex !== -1 ? row[compareAtColIndex]?.toString().trim() : null;
      const numCompare = rawCompare ? parseFloat(rawCompare) : null;

      if (priceChanged || (numCompare && numCompare !== parseFloat(matchedVariant.compareAtPrice))) {
        pricesToAdd.push({
          variantId: matchedVariant.variantId,
          productId: matchedVariant.productId,
          price: {
            amount: numPrice.toFixed(2),
            currencyCode: market.currency,
          },
          ...(numCompare
            ? {
                compareAtPrice: {
                  amount: numCompare.toFixed(2),
                  currencyCode: market.currency,
                },
              }
            : {}),
        });

        if (matchType === "SKU") matchedBySkuCount++;
        else matchedByGidCount++;
      } else {
        skippedCount++;
      }
    }

    let successCount = 0;
    let errors = [];

    // 3. Batch apply updates
    if (market.primary) {
      // Primary market updates base variant prices directly
      const basePrices = pricesToAdd.map((p) => ({
        variantId: p.variantId,
        productId: p.productId,
        price: p.price.amount,
        compareAtPrice: p.compareAtPrice?.amount,
      }));
      const res = await batchUpdateBaseVariantPrices(admin, basePrices);
      successCount = res.successCount;
      errors = res.errors;
    } else {
      // Secondary market updates priceList overrides
      if (!market.priceListId) {
        market.priceListId = await ensureMarketPriceList(admin, market);
      }
      if (!market.priceListId) {
        throw new Error(
          `Market "${market.name}" does not have a PriceList enabled yet. In Shopify Admin > Markets > ${market.name} > Pricing, ensure fixed pricing or price adjustments are active.`
        );
      }
      const res = await batchUpdatePriceList(admin, {
        priceListId: market.priceListId,
        pricesToAdd,
      });
      successCount = res.successCount;
      errors = res.errors;
    }

    const summary = `Synced from tab "${tabTitle}" into market "${market.name}". Updated ${successCount} prices (${matchedBySkuCount} matched via SKU, ${matchedByGidCount} matched via Variant ID). Skipped ${skippedCount} unchanged/unmatched.`;

    await updateSyncJob(syncJob.id, {
      status: errors.length > 0 ? "PARTIAL_FAILED" : "SUCCESS",
      summary,
      errorLogs: errors.length > 0 ? errors.join("; ") : null,
      completed: true,
    });

    return { success: true, summary, errors, matchedBySkuCount, matchedByGidCount };
  } catch (error) {
    console.error("Import pricing error:", error);
    await updateSyncJob(syncJob.id, {
      status: "FAILED",
      errorLogs: error.message,
      completed: true,
    });
    throw error;
  }
}
