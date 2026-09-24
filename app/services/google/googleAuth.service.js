import { google } from "googleapis";
import { updateGoogleAccessToken } from "../../repository/user.repository";

/**
 * Returns an authenticated Google OAuth2 client for the given GoogleAccount record.
 * Automatically refreshes the token if expired or about to expire in the next 5 minutes.
 */
export async function getAuthenticatedOAuthClient(googleAccount) {
  if (!googleAccount) {
    throw new Error("Google account record is required for authentication");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: googleAccount.accessToken,
    refresh_token: googleAccount.refreshToken,
    expiry_date: googleAccount.accessTokenExpiresAt
      ? new Date(googleAccount.accessTokenExpiresAt).getTime()
      : undefined,
  });

  // Check if token needs refresh (within 5 minutes of expiring)
  const isExpiring =
    googleAccount.accessTokenExpiresAt &&
    new Date(googleAccount.accessTokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000;

  if (isExpiring && googleAccount.refreshToken) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      const credentials = refreshed.credentials;

      await updateGoogleAccessToken({
        googleAccountId: googleAccount.id,
        accessToken: credentials.access_token,
        expiresIn: credentials.expiry_date
          ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
          : 3600,
        refreshToken: credentials.refresh_token,
      });

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error("Failed to refresh Google access token:", error);
      throw new Error("Google access token expired. Please re-authenticate your Google account.");
    }
  }

  return oauth2Client;
}
