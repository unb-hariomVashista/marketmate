import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { UnauthenticatedHome } from "../components/UnauthenticatedHome";
import { AuthenticatedHome } from "../components/AuthenticatedHome";
import {
  getGoogleAccountByShop,
  getStoresLinkedToGoogleAccount,
} from "../repository/user.repository";
import { getSheetsByGoogleAccountId } from "../repository/sheet.repository";
import { getRecentSyncJobsByShop } from "../repository/sync.repository";
import { getStorePlan } from "../services/plan.service";
import { generateGoogleOAuthUrlAndHeaders } from "../services/google/googleAuth.service";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Check if this shop already has a connected Google account and current subscription
  const [googleAccount, storePlan] = await Promise.all([
    getGoogleAccountByShop(shop),
    getStorePlan(shop, billing),
  ]);

  if (googleAccount) {
    const [linkedStores, spreadsheets, recentJobs] = await Promise.all([
      getStoresLinkedToGoogleAccount(googleAccount.id),
      getSheetsByGoogleAccountId(googleAccount.id),
      getRecentSyncJobsByShop(shop, 5),
    ]);

    return Response.json({
      googleAccount: {
        id: googleAccount.id,
        email: googleAccount.email,
        name: googleAccount.name,
        pictureUrl: googleAccount.pictureUrl,
      },
      currentShop: shop,
      linkedStores,
      spreadsheets,
      recentJobs,
      storePlan,
      googleOauthUrl: null,
    });
  }

  // 2. If not connected, generate state and Google OAuth URL
  const { googleOauthUrl, headers } = generateGoogleOAuthUrlAndHeaders(shop);

  return Response.json(
    { googleOauthUrl, googleAccount: null },
    { headers }
  );
};

export default function Index() {
  const shopify = useAppBridge();
  const {
    googleOauthUrl,
    googleAccount,
    currentShop,
    linkedStores = [],
    spreadsheets = [],
    recentJobs = [],
    storePlan = null,
  } = useLoaderData();

  const isConnected = !!googleAccount;

  const handleGoogleSignIn = () => {
    if (!googleOauthUrl) {
      shopify.toast.show("Authentication URL not ready", { isError: true });
      return;
    }

    window.top.location.href = googleOauthUrl;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] w-full overflow-x-hidden p-3 sm:p-5 md:p-6">
      {!isConnected ? (
        <UnauthenticatedHome signInHandler={handleGoogleSignIn} />
      ) : (
        <AuthenticatedHome
          googleAccount={googleAccount}
          currentShop={currentShop}
          linkedStores={linkedStores}
          spreadsheets={spreadsheets}
          recentJobs={recentJobs}
          storePlan={storePlan}
        />
      )}
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
