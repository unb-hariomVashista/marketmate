import { useEffect } from "react";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { UnauthenticatedHome } from "../components/UnauthenticatedHome";
import { AuthenticatedHome } from "../components/AuthenticatedHome";
import { getGoogleAccountByShop } from "../repository/user.repository";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Check if this shop already has a connected Google account
  const googleAccount = await getGoogleAccountByShop(shop);

  if (googleAccount) {
    return Response.json({
      googleAccount: {
        id: googleAccount.id,
        email: googleAccount.email,
        name: googleAccount.name,
        pictureUrl: googleAccount.pictureUrl,
      },
      googleOauthUrl: null,
    });
  }

  // 2. If not connected, generate state and Google OAuth URL
  const state = crypto.randomUUID();
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    client_id: process.env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ].join(' '),
    state
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
    { googleOauthUrl, googleAccount: null },
    { headers }
  );
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
};

export default function Index() {
  const shopify = useAppBridge();
  const { googleOauthUrl, googleAccount } = useLoaderData();

  const isConnected = !!googleAccount;

  const handleGoogleSignIn = () => {
    if (!googleOauthUrl) {
      shopify.toast.show("Authentication URL not ready", { isError: true });
      return;
    }

    window.top.location.href = googleOauthUrl;
  };

  return (
    <s-page heading="MarketMate">
      {!isConnected ? (
        <UnauthenticatedHome signInHandler={handleGoogleSignIn} />
      ) : (
        <AuthenticatedHome googleAccount={googleAccount} />
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
