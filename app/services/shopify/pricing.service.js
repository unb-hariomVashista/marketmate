import crypto from "crypto";
import { executeGraphQLWithRetry } from "./graphqlClient";

/**
 * Fetches all products with base variant prices, along with market-specific prices via Shopify's contextualPricing API.
 */
export async function fetchProductsWithPricing(
  admin,
  { countryCode = null } = {}
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

    const data = await executeGraphQLWithRetry(admin, useQuery, { variables });

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
    if (allVariants.length >= 2500) {
      console.warn("Reached maximum variants pagination cap (2500).");
      break;
    }
  }

  return allVariants;
}

/**
 * Ensures a non-primary Market has an active PriceList, creating one if not already created.
 */
export async function ensureMarketPriceList(admin, market) {
  if (market.priceListId) return market.priceListId;

  let catalogId = market.catalogId;

  // Always query the market's catalogs to ensure we have the latest PriceList association
  const marketQuery = `#graphql
    query GetMarketCatalogDetails($id: ID!) {
      market(id: $id) {
        id
        name
        catalogs(first: 10) {
          nodes {
            id
            title
            status
            __typename
            priceList {
              id
              name
              currency
            }
          }
        }
      }
    }
  `;

  try {
    const data = await executeGraphQLWithRetry(admin, marketQuery, { variables: { id: market.id } });
    const catalogNodes = data.data?.market?.catalogs?.nodes || [];

    // Case 1: Multiple catalogs exist.
    // Prioritize retail MarketCatalog over B2B CompanyLocationCatalog, and look for existing priceList
    const catWithPriceList =
      catalogNodes.find((c) => c.__typename === "MarketCatalog" && c.priceList?.id) ||
      catalogNodes.find((c) => c.priceList?.id);

    if (catWithPriceList?.priceList?.id) {
      market.priceListId = catWithPriceList.priceList.id;
      market.catalogId = catWithPriceList.id;
      return catWithPriceList.priceList.id;
    }

    // If no priceList yet, pick the active MarketCatalog
    const targetCatalog =
      catalogNodes.find((c) => c.__typename === "MarketCatalog" && c.status === "ACTIVE") ||
      catalogNodes.find((c) => c.status === "ACTIVE") ||
      catalogNodes[0];

    if (targetCatalog?.id) {
      catalogId = targetCatalog.id;
      market.catalogId = targetCatalog.id;
    }
  } catch (e) {
    console.warn("Could not query market catalogs:", e.message);
  }

  // Case 2: Zero catalogs attached to this market.
  // Automatically create a new Catalog linked to this market context via catalogCreate
  if (!catalogId) {
    console.info(`No catalog attached to market ${market.name}. Creating one automatically...`);
    const catalogCreateMutation = `#graphql
      mutation CreateCatalogForMarket($input: CatalogCreateInput!) {
        catalogCreate(input: $input) {
          catalog {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const catRes = await executeGraphQLWithRetry(admin, catalogCreateMutation, {
        variables: {
          input: {
            title: `${market.name} Catalog`,
            status: "ACTIVE",
            context: {
              marketIds: [market.id],
            },
          },
        },
      });

      const newCatId = catRes.data?.catalogCreate?.catalog?.id;
      if (newCatId) {
        catalogId = newCatId;
        market.catalogId = newCatId;
      } else {
        const uErr = catRes.data?.catalogCreate?.userErrors?.map((e) => e.message).join(", ");
        console.error("catalogCreate error:", uErr);
      }
    } catch (createCatErr) {
      console.error("Failed to automatically create catalog for market:", createCatErr.message);
    }
  }

  if (!catalogId) {
    console.error(`Unable to resolve or create catalog for market ${market.name} (${market.id})`);
    return null;
  }

  const createMutation = `#graphql
    mutation CreatePriceListForMarket($input: PriceListCreateInput!) {
      priceListCreate(input: $input) {
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
    const createData = await executeGraphQLWithRetry(admin, createMutation, {
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
      },
    });
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
 * Updates prices on a Shopify Market PriceList in chunks of up to 50.
 */
export async function batchUpdatePriceList(admin, { priceListId, pricesToAdd = [] }) {
  if (!priceListId || pricesToAdd.length === 0) {
    return { successCount: 0, errors: [] };
  }

  // Deduplicate by variantId (Shopify mandates unique variants in pricesToAdd)
  const uniqueMap = new Map();
  for (const item of pricesToAdd) {
    if (item?.variantId) {
      uniqueMap.set(item.variantId, item);
    }
  }
  const sanitizedPrices = Array.from(uniqueMap.values());

  const mutation = `#graphql
    mutation UpdatePriceListPrices(
      $priceListId: ID!
      $pricesToAdd: [PriceListPriceInput!]!
      $variantIdsToDelete: [ID!]!
    ) {
      priceListFixedPricesUpdate(
        priceListId: $priceListId
        pricesToAdd: $pricesToAdd
        variantIdsToDelete: $variantIdsToDelete
      ) {
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

  const CHUNK_SIZE = 50;
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < sanitizedPrices.length; i += CHUNK_SIZE) {
    // Sanitize chunk to ONLY valid PriceListPriceInput fields (variantId, price, compareAtPrice)
    const chunk = sanitizedPrices.slice(i, i + CHUNK_SIZE).map((p) => {
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
      const data = await executeGraphQLWithRetry(admin, mutation, {
        variables: {
          priceListId,
          pricesToAdd: chunk,
          variantIdsToDelete: [],
        },
      });

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

    if (i + CHUNK_SIZE < sanitizedPrices.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { successCount, errors };
}

/**
 * Updates core base variant prices in Shopify (used for Primary Market updates).
 */
export async function batchUpdateBaseVariantPrices(admin, variantPrices = []) {
  if (variantPrices.length === 0) return { successCount: 0, errors: [] };

  // Deduplicate by productId -> variantId
  const byProduct = new Map();
  for (const item of variantPrices) {
    if (!item.productId || !item.variantId) continue;
    if (!byProduct.has(item.productId)) {
      byProduct.set(item.productId, new Map());
    }
    byProduct.get(item.productId).set(item.variantId, {
      id: item.variantId,
      price: item.price,
      ...(item.compareAtPrice ? { compareAtPrice: item.compareAtPrice } : {}),
    });
  }

  const mutation = `#graphql
    mutation UpdateBasePrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
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
  const productEntries = Array.from(byProduct.entries()).map(([productId, variantMap]) => [
    productId,
    Array.from(variantMap.values()),
  ]);
  const CONCURRENCY = 2;

  for (let i = 0; i < productEntries.length; i += CONCURRENCY) {
    const batch = productEntries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([productId, variants]) => {
        try {
          const data = await executeGraphQLWithRetry(admin, mutation, {
            variables: { productId, variants },
          });

          if (data.errors && data.errors.length > 0) {
            errors.push(...data.errors.map((e) => e.message));
            return;
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
      })
    );

    if (i + CONCURRENCY < productEntries.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return { successCount, errors };
}
