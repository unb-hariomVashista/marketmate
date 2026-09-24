/**
 * Fetches all products with base variant prices, along with market-specific prices via Shopify's contextualPricing API.
 */
export async function fetchProductsWithPricing(
  admin,
  { countryCode = null, marketId = null, priceListId = null } = {}
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

  const CHUNK_SIZE = 100;
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < pricesToAdd.length; i += CHUNK_SIZE) {
    const chunk = pricesToAdd.slice(i, i + CHUNK_SIZE);

    try {
      const response = await admin.graphql(mutation, {
        variables: {
          priceListId,
          pricesToAdd: chunk,
          variantIdsToDelete: [],
        },
      });

      const data = await response.json();
      const userErrors = data.data?.priceListFixedPricesUpdate?.userErrors || [];

      if (userErrors.length > 0) {
        errors.push(...userErrors.map((e) => e.message));
      } else {
        successCount += chunk.length;
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

  for (const [productId, variants] of byProduct.entries()) {
    try {
      const response = await admin.graphql(mutation, {
        variables: { productId, variants },
      });
      const data = await response.json();
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
