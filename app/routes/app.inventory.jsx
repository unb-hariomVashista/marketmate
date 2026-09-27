import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getGoogleAccountByShop } from "../repository/user.repository";
import { getSheetsByGoogleAccountId } from "../repository/sheet.repository";
import { getStoreMarketsAndLocations } from "../services/shopify/market.service";
import { getStorePlan, checkFeatureAccess } from "../services/plan.service";
import { MultiMarketSyncView } from "../components/sync/MultiMarketSyncView";
import { generateGoogleOAuthUrlAndHeaders } from "../services/google/googleAuth.service";

export const loader = async ({ request }) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const [googleAccount, storePlan] = await Promise.all([
    getGoogleAccountByShop(shop),
    getStorePlan(shop, billing),
  ]);

  if (!googleAccount) {
    const { googleOauthUrl, headers } = generateGoogleOAuthUrlAndHeaders(shop);

    return Response.json(
      {
        connected: false,
        googleAccount: null,
        googleOauthUrl,
        markets: [],
        locations: [],
        spreadsheets: [],
        storePlan,
        planAccess: {
          allowed: false,
          reason: "NO_GOOGLE_ACCOUNT",
          message: "Connect your Google account to begin.",
        },
      },
      { headers }
    );
  }

  const [sheets, storeData] = await Promise.all([
    getSheetsByGoogleAccountId(googleAccount.id, "INVENTORY"),
    getStoreMarketsAndLocations(admin),
  ]);

  const planAccess = checkFeatureAccess({
    plan: storePlan.plan,
    type: "INVENTORY",
    locationsCount: storeData.locations?.length || 0,
    marketsCount: storeData.markets?.length || 0,
  });

  return Response.json({
    connected: true,
    shop: storeData.shop,
    googleAccount: {
      id: googleAccount.id,
      email: googleAccount.email,
    },
    markets: storeData.markets,
    locations: storeData.locations,
    spreadsheets: sheets,
    googleOauthUrl: null,
    storePlan,
    planAccess,
  });
};

export default function InventoryPage() {
  const data = useLoaderData();

  return (
    <MultiMarketSyncView
      type="INVENTORY"
      connected={data.connected}
      googleAccount={data.googleAccount}
      googleOauthUrl={data.googleOauthUrl}
      spreadsheets={data.spreadsheets || []}
      markets={data.markets || []}
      locations={data.locations || []}
      shop={data.shop}
      currentShop={data.shop?.myshopifyDomain || ""}
      storePlan={data.storePlan}
      planAccess={data.planAccess}
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
