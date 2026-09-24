/**
 * Queries all markets and locations from Shopify Admin GraphQL API.
 */
export async function getStoreMarketsAndLocations(admin) {
  const query = `#graphql
    query GetMarketsAndLocations {
      shop {
        name
        myshopifyDomain
        currencyCode
      }
      markets(first: 50) {
        nodes {
          id
          name
          handle
          enabled
          primary
          currencySettings {
            baseCurrency {
              currencyCode
              currencyName
            }
          }
          regions(first: 10) {
            nodes {
              id
              name
              ... on MarketRegionCountry {
                code
              }
            }
          }
          catalogs(first: 5) {
            nodes {
              id
              title
              status
              priceList {
                id
                name
                currency
              }
            }
          }
        }
      }
      locations(first: 50, includeInactive: false) {
        nodes {
          id
          name
          isActive
          shipsInventory
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL errors fetching markets:", data.errors);
    throw new Error(data.errors.map((e) => e.message).join(", "));
  }

  const shop = data.data.shop;
  const markets = data.data.markets.nodes.map((m) => {
    const catalog = m.catalogs.nodes[0] || null;
    const priceList = catalog?.priceList || null;
    const currency = m.currencySettings?.baseCurrency?.currencyCode || shop.currencyCode;
    const countryRegion = m.regions?.nodes?.find((r) => r.code);
    const primaryCountryCode = countryRegion?.code || null;

    return {
      id: m.id,
      name: m.name,
      handle: m.handle,
      enabled: m.enabled,
      primary: m.primary,
      currency,
      primaryCountryCode,
      catalogId: catalog?.id || null,
      priceListId: priceList?.id || null,
    };
  });

  const locations = data.data.locations.nodes.map((l) => ({
    id: l.id,
    name: l.name,
    isActive: l.isActive,
    shipsInventory: l.shipsInventory,
  }));

  return {
    shop,
    markets,
    locations,
  };
}
