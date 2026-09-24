/**
 * Fetches products, variants, and their inventory levels across specific locations.
 */
export async function fetchProductsWithInventory(admin, locationIds = []) {
  const query = `#graphql
    query GetVariantsWithInventory($cursor: String) {
      productVariants(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          sku
          barcode
          product {
            id
            title
            status
          }
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 10) {
              nodes {
                id
                location {
                  id
                  name
                }
                quantities(names: ["available"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let cursor = null;
  const allVariants = [];

  while (hasNextPage) {
    const response = await admin.graphql(query, { variables: { cursor } });
    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e) => e.message).join(", "));
    }

    const variants = data.data?.productVariants?.nodes || [];
    for (const variant of variants) {
      const inventoryByLocation = {};

      if (variant.inventoryItem?.inventoryLevels?.nodes) {
        for (const level of variant.inventoryItem.inventoryLevels.nodes) {
          const locId = level.location.id;
          const availableQty =
            level.quantities.find((q) => q.name === "available")?.quantity ?? 0;
          inventoryByLocation[locId] = availableQty;
        }
      }

      allVariants.push({
        productId: variant.product?.id || "",
        productTitle: variant.product?.title || "",
        productStatus: variant.product?.status || "",
        variantId: variant.id,
        variantTitle: variant.title === "Default Title" ? "" : variant.title,
        sku: variant.sku || "",
        barcode: variant.barcode || "",
        inventoryItemId: variant.inventoryItem?.id || null,
        inventoryTracked: variant.inventoryItem?.tracked || false,
        quantitiesByLocation: inventoryByLocation,
      });
    }

    hasNextPage = data.data?.productVariants?.pageInfo?.hasNextPage || false;
    cursor = data.data?.productVariants?.pageInfo?.endCursor || null;

    // Safety limit: if > 1000 items in dev, avoid excessive pagination
    if (allVariants.length >= 1000) break;
  }

  return allVariants;
}

/**
 * Executes Shopify inventorySetQuantities mutation in batches of up to 100 items.
 */
export async function batchUpdateInventoryQuantities(admin, quantityInputs) {
  if (!quantityInputs || quantityInputs.length === 0) {
    return { successCount: 0, errors: [] };
  }

  const mutation = `#graphql
    mutation SetInventoryQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup {
          reason
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const CHUNK_SIZE = 100;
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < quantityInputs.length; i += CHUNK_SIZE) {
    const chunk = quantityInputs.slice(i, i + CHUNK_SIZE);

    try {
      const response = await admin.graphql(mutation, {
        variables: {
          input: {
            name: "available",
            reason: "correction",
            ignoreCompareQuantity: true,
            quantities: chunk,
          },
        },
      });

      const data = await response.json();
      const userErrors = data.data?.inventorySetQuantities?.userErrors || [];

      if (userErrors.length > 0) {
        errors.push(...userErrors.map((e) => e.message));
      } else {
        successCount += chunk.length;
      }
    } catch (err) {
      console.error("Inventory update chunk failure:", err);
      errors.push(err.message);
    }
  }

  return { successCount, errors };
}
