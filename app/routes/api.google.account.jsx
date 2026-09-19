import { authenticate } from "../shopify.server";
import {
  getGoogleAccountByShop,
  disconnectGoogleAccountFromShop,
} from "../repository/user.repository";

/**
 * GET /api/google/account
 * Retrieves the connected Google account for the authenticated Shopify store.
 */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const account = await getGoogleAccountByShop(shop);

  if (!account) {
    return Response.json(
      {
        connected: false,
        data: null,
      },
      { status: 200 }
    );
  }

  return Response.json(
    {
      connected: true,
      data: {
        id: account.id,
        email: account.email,
        name: account.name,
        pictureUrl: account.pictureUrl,
        scope: account.scope,
        accessTokenExpiresAt: account.accessTokenExpiresAt,
        connectedAt: account.createdAt,
      },
    },
    { status: 200 }
  );
};

/**
 * DELETE /api/google/account
 * Disconnects the Google account for the authenticated Shopify store.
 */
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (request.method === "DELETE") {
    await disconnectGoogleAccountFromShop(shop);

    return Response.json(
      {
        success: true,
        message: "Google account disconnected successfully.",
      },
      { status: 200 }
    );
  }

  return Response.json(
    { error: `Method ${request.method} Not Allowed` },
    { status: 405 }
  );
};
