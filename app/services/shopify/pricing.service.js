import crypto from "crypto";

/**
 * Fetches all products with base variant prices, along with market-specific prices via Shopify's contextualPricing API.
 */
export async function fetchProductsWithPricing(
  admin,
  { countryCode = null, marketId: _marketId = null, priceListId: _priceListId = null } = {}
) {
  const queryWithContext = `#graphql
    query GetVariantsWithContextualPricing($cursor: String, $context: ContextualPricingContext!) {
      productVariants(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          product {
            id
            title
            status
          }
          contextualPricing(context: $context) {
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;

  const queryBaseOnly = `#graphql
    query GetVariantsBasePricing($cursor: String) {
      productVariants(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          product {
            id
            title
            status
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let cursor = null;
  const allVariants = [];

  const useQuery = countryCode ? queryWithContext : queryBaseOnly;

  while (hasNextPage) {
    const variables = { cursor };
    if (countryCode) {
      variables.context = { country: countryCode };
    }

    const response = await admin.graphql(useQuery, { variables });
    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e) => e.message).join(", "));
    }

    const variants = data.data?.productVariants?.nodes || [];
    for (const variant of variants) {
      const marketPriceObj = variant.contextualPricing?.price?.amount;
      const marketCompareObj = variant.contextualPricing?.compareAtPrice?.amount;

      allVariants.push({
        productId: variant.product?.id || "",
        productTitle: variant.product?.title || "",
        productStatus: variant.product?.status || "",
        variantId: variant.id,
        variantTitle: variant.title === "Default Title" ? "" : variant.title,
        sku: variant.sku || "",
        basePrice: variant.price,
        compareAtPrice: marketCompareObj || variant.compareAtPrice || "",
        marketPrice: marketPriceObj || variant.price,
      });
    }

    hasNextPage = data.data?.productVariants?.pageInfo?.hasNextPage || false;
    cursor = data.data?.productVariants?.pageInfo?.endCursor || null;
    if (allVariants.length >= 1000) break;
  }

  return allVariants;
}

/**
 * Ensures a non-primary Market has an active PriceList, creating one if not already created.
 */
export async function ensureMarketPriceList(admin, market) {
  if (market.priceListId) return market.priceListId;

  let catalogId = market.catalogId;
  if (!catalogId) {
    const marketQuery = `#graphql
      query GetMarketCatalog($id: ID!) {
        market(id: $id) {
          catalogs(first: 5) {
            nodes {
              id
              priceList {
                id
              }
            }
          }
        }
      }
    `;
    try {
      const res = await admin.graphql(marketQuery, { variables: { id: market.id } });
      const data = await res.json();
      const cat =
        data.data?.market?.catalogs?.nodes?.find((c) => c.priceList?.id) ||
        data.data?.market?.catalogs?.nodes?.[0];
      if (cat?.priceList?.id) {
        market.priceListId = cat.priceList.id;
        return cat.priceList.id;
      }
      if (cat?.id) {
        catalogId = cat.id;
      }
    } catch (e) {
      console.warn("Could not query market catalog:", e.message);
    }
  }

  if (!catalogId) {
    return null;
  }

  const createMutation = `#graphql
    mutation CreatePriceListForMarket($input: PriceListCreateInput!, $idempotencyKey: String!) {
      priceListCreate(input: $input) @idempotent(key: $idempotencyKey) {
        priceList {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const createRes = await admin.graphql(createMutation, {
      variables: {
        input: {
          name: `${market.name} Price List`,
          currency: market.currency,
          catalogId,
          parent: {
            adjustment: {
              type: "PERCENTAGE_DECREASE",
              value: 0.0,
            },
          },
        },
        idempotencyKey: crypto.randomUUID(),
      },
    });
    const createData = await createRes.json();
    const createdId = createData.data?.priceListCreate?.priceList?.id;
    if (createdId) {
      market.priceListId = createdId;
      return createdId;
    }
    if (createData.errors && createData.errors.length > 0) {
      console.warn("priceListCreate GraphQL error:", createData.errors);
    }
  } catch (err) {
    console.warn("priceListCreate error:", err.message);
  }

  return null;
}

/**
 * Updates prices on a Shopify Market PriceList in chunks of up to 100.
 */
export async function batchUpdatePriceList(admin, { priceListId, pricesToAdd = [] }) {
  if (!priceListId || pricesToAdd.length === 0) {
    return { successCount: 0, errors: [] };
  }

  const mutation = `#graphql
    mutation UpdatePriceListPrices(
      $priceListId: ID!
      $pricesToAdd: [PriceListPriceInput!]!
      $variantIdsToDelete: [ID!]!
      $idempotencyKey: String!
    ) {
      priceListFixedPricesUpdate(
        priceListId: $priceListId
        pricesToAdd: $pricesToAdd
        variantIdsToDelete: $variantIdsToDelete
      ) @idempotent(key: $idempotencyKey) {
        prices {
          price {
            amount
          }
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

  for (let i = 0; i < pricesToAdd.length; i += CHUNK_SIZE) {
    // Sanitize chunk to ONLY valid PriceListPriceInput fields (variantId, price, compareAtPrice)
    const chunk = pricesToAdd.slice(i, i + CHUNK_SIZE).map((p) => {
      const item = {
        variantId: p.variantId,
        price: p.price,
      };
      if (p.compareAtPrice && p.compareAtPrice.amount && p.compareAtPrice.currencyCode) {
        item.compareAtPrice = p.compareAtPrice;
      }
      return item;
    });

    try {
      const response = await admin.graphql(mutation, {
        variables: {
          priceListId,
          pricesToAdd: chunk,
          variantIdsToDelete: [],
          idempotencyKey: crypto.randomUUID(),
        },
      });

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        errors.push(...data.errors.map((e) => e.message));
        continue;
      }

      const userErrors = data.data?.priceListFixedPricesUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        errors.push(...userErrors.map((e) => e.message));
      } else if (data.data?.priceListFixedPricesUpdate?.prices) {
        successCount += chunk.length;
      } else {
        errors.push("Failed to update prices on PriceList");
      }
    } catch (err) {
      console.error("PriceList update failure:", err);
      errors.push(err.message);
    }
  }

  return { successCount, errors };
}

/**
 * Updates core base variant prices in Shopify (used for Primary Market updates).
 */
export async function batchUpdateBaseVariantPrices(admin, variantPrices = []) {
  if (variantPrices.length === 0) return { successCount: 0, errors: [] };

  const byProduct = new Map();
  for (const item of variantPrices) {
    if (!item.productId) continue;
    if (!byProduct.has(item.productId)) {
      byProduct.set(item.productId, []);
    }
    byProduct.get(item.productId).push({
      id: item.variantId,
      price: item.price,
      ...(item.compareAtPrice ? { compareAtPrice: item.compareAtPrice } : {}),
    });
  }

  const mutation = `#graphql
    mutation UpdateBasePrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $idempotencyKey: String!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) @idempotent(key: $idempotencyKey) {
        productVariants {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  let successCount = 0;
  const errors = [];

  for (const [productId, variants] of byProduct.entries()) {
    try {
      const response = await admin.graphql(mutation, {
        variables: { productId, variants, idempotencyKey: crypto.randomUUID() },
      });
      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        errors.push(...data.errors.map((e) => e.message));
        continue;
      }

      const userErrors = data.data?.productVariantsBulkUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        errors.push(...userErrors.map((e) => e.message));
      } else {
        successCount += variants.length;
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { successCount, errors };
}
