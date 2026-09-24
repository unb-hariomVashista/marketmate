import prisma from "../db.server";

/**
 * Connects or updates a Google account and links it to a Shopify store.
 * Handles:
 * 1. Upserting the GoogleAccount (shared if same Google user connects multiple stores).
 * 2. Upserting the StoreGoogleConnection for the specific Shopify shop (1 store -> 1 Google account).
 */
export async function linkGoogleAccountToStore({ shop, googleUser, tokens }) {
  const { googleUserId, email, name, pictureUrl } = googleUser;
  const { access_token, refresh_token, expires_in, scope } = tokens;

  const accessTokenExpiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : null;

  return prisma.$transaction(async (tx) => {
    // 1. Upsert the Google account
    const googleAccount = await tx.googleAccount.upsert({
      where: { googleUserId },
      create: {
        googleUserId,
        email,
        name: name || null,
        pictureUrl: pictureUrl || null,
        accessToken: access_token,
        accessTokenExpiresAt,
        refreshToken: refresh_token || null,
        scope: scope || null,
      },
      update: {
        email,
        name: name || undefined,
        pictureUrl: pictureUrl || undefined,
        accessToken: access_token,
        accessTokenExpiresAt,
        // Only overwrite refresh token if Google returned a new one
        ...(refresh_token ? { refreshToken: refresh_token } : {}),
        scope: scope || undefined,
      },
    });

    // 2. Link this shop to the Google account
    const storeConnection = await tx.storeGoogleConnection.upsert({
      where: { shop },
      create: {
        shop,
        googleAccountId: googleAccount.id,
      },
      update: {
        googleAccountId: googleAccount.id,
      },
      include: {
        googleAccount: true,
      },
    });

    return storeConnection.googleAccount;
  });
}

/**
 * Retrieves the connected Google account for a given Shopify shop.
 */
export async function getGoogleAccountByShop(shop) {
  if (!shop) return null;

  const connection = await prisma.storeGoogleConnection.findUnique({
    where: { shop },
    include: {
      googleAccount: true,
    },
  });

  return connection?.googleAccount || null;
}

/**
 * Disconnects the Google account for a given Shopify shop.
 */
export async function disconnectGoogleAccountFromShop(shop) {
  if (!shop) return null;

  return prisma.storeGoogleConnection.delete({
    where: { shop },
  });
}

/**
 * Updates refreshed access token for a Google account.
 */
export async function updateGoogleAccessToken({ googleAccountId, accessToken, expiresIn, refreshToken }) {
  const accessTokenExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  return prisma.googleAccount.update({
    where: { id: googleAccountId },
    data: {
      accessToken,
      accessTokenExpiresAt,
      ...(refreshToken ? { refreshToken } : {}),
    },
  });
}

/**
 * Retrieves a Google account by primary key ID.
 */
export async function getGoogleAccountById(id) {
  if (!id) return null;
  return prisma.googleAccount.findUnique({
    where: { id },
  });
}

/**
 * Retrieves all stores linked to a given Google account.
 */
export async function getStoresLinkedToGoogleAccount(googleAccountId) {
  if (!googleAccountId) return [];
  return prisma.storeGoogleConnection.findMany({
    where: { googleAccountId },
    select: {
      shop: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
