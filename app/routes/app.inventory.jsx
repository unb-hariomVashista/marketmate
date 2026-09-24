import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getGoogleAccountByShop } from "../repository/user.repository";
import { getSheetsByGoogleAccountId } from "../repository/sheet.repository";
import { getStoreMarketsAndLocations } from "../services/shopify/market.service";
import { MultiMarketSyncView } from "../components/sync/MultiMarketSyncView";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const googleAccount = await getGoogleAccountByShop(shop);

  if (!googleAccount) {
    // Generate OAuth URL if not connected
    const state = crypto.randomUUID();
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      client_id: process.env.GOOGLE_CLIENT_ID,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ].join(" "),
      state,
    };
    const qs = new URLSearchParams(options).toString();
    const googleOauthUrl = `${rootUrl}?${qs}`;

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=3600`
    );
    headers.append(
      "Set-Cookie",
      `oauth_shop=${shop}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=3600`
    );

    return Response.json(
      {
        connected: false,
        googleAccount: null,
        googleOauthUrl,
        markets: [],
        locations: [],
        spreadsheets: [],
      },
      { headers }
    );
  }

  const [sheets, storeData] = await Promise.all([
    getSheetsByGoogleAccountId(googleAccount.id, "INVENTORY"),
    getStoreMarketsAndLocations(admin),
  ]);

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
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
