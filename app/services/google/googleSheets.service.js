import { google } from "googleapis";
import { getAuthenticatedOAuthClient } from "./googleAuth.service.js";
import {
  getSheetsByGoogleAccountId,
  upsertSpreadsheet,
} from "../../repository/sheet.repository.js";

/**
 * Creates a new Google Spreadsheet in the user's Google Drive.
 */
export async function createSpreadsheet({ googleAccount, title, initialTabTitle = "Overview" }) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const sheets = google.sheets({ version: "v4", auth });

  const resource = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: initialTabTitle,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  const response = await sheets.spreadsheets.create({
    resource,
    fields: "spreadsheetId,spreadsheetUrl,sheets.properties",
  });

  const sheetData = response.data;
  const initialSheetId = sheetData.sheets?.[0]?.properties?.sheetId || 0;

  // Make spreadsheet editable by anyone with the link
  try {
    const drive = google.drive({ version: "v3", auth });
    await grantSheetEditPermissions(drive, sheetData.spreadsheetId, googleAccount);
  } catch (permError) {
    console.error(
      "Failed to set permissions on new spreadsheet:",
      permError.response?.data?.error || permError.message,
    );
  }

  return {
    spreadsheetId: sheetData.spreadsheetId,
    spreadsheetUrl: sheetData.spreadsheetUrl,
    initialSheetId,
  };
}

/**
 * Grants edit permissions to anyone, with fallback to company domain if organization blocks public sharing.
 */
async function grantSheetEditPermissions(drive, spreadsheetId, googleAccount) {
  try {
    await drive.permissions.create({
      fileId: spreadsheetId,
      supportsAllDrives: true,
      requestBody: {
        role: "writer",
        type: "anyone",
      },
    });
    return { success: true, level: "anyone" };
  } catch (err) {
    const reason = err.response?.data?.error?.errors?.[0]?.reason;
    if (reason === "publishOutNotPermitted" && googleAccount?.email) {
      const emailDomain = googleAccount.email.split("@")[1];
      if (emailDomain && emailDomain !== "gmail.com") {
        try {
          await drive.permissions.create({
            fileId: spreadsheetId,
            supportsAllDrives: true,
            requestBody: {
              role: "writer",
              type: "domain",
              domain: emailDomain,
            },
          });
          return { success: true, level: "domain", domain: emailDomain };
        } catch (domainErr) {
          console.error("Domain sharing failed:", domainErr.response?.data?.error || domainErr.message);
        }
      }
    }
    console.error("Failed to set edit permissions on sheet:", err.response?.data?.error || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Ensures a spreadsheet has edit permissions.
 */
export async function makeSpreadsheetPubliclyEditable({ googleAccount, spreadsheetId }) {
  try {
    const auth = await getAuthenticatedOAuthClient(googleAccount);
    const drive = google.drive({ version: "v3", auth });
    return await grantSheetEditPermissions(drive, spreadsheetId, googleAccount);
  } catch (err) {
    console.error(
      "Error granting edit permissions to spreadsheet:",
      err.response?.data?.error || err.message,
    );
    return false;
  }
}

/**
 * Retrieves metadata for a spreadsheet (e.g. list of existing sheets/tabs).
 */
export async function getSpreadsheetInfo({ googleAccount, spreadsheetId }) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,properties.title,sheets.properties",
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    title: response.data.properties?.title,
    tabs: response.data.sheets?.map((s) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
      index: s.properties?.index,
    })) || [],
  };
}

/**
 * Checks if a tab exists by name; creates it if it doesn't.
 * Also freezes the header row (frozenRowCount = 1).
 */
export async function ensureTabExists({ googleAccount, spreadsheetId, tabTitle }) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const sheets = google.sheets({ version: "v4", auth });

  const info = await getSpreadsheetInfo({ googleAccount, spreadsheetId });
  const existingTab = info.tabs.find((t) => t.title === tabTitle);

  if (existingTab) {
    return { sheetId: existingTab.sheetId, created: false };
  }

  // Look for an initial placeholder tab (e.g. "INVENTORY Overview", "PRICING Overview", "Overview", or "Sheet1")
  // If it's a fresh sheet or the placeholder tab is empty, overwrite it by renaming it to tabTitle
  const placeholderTab = info.tabs.find((t) => {
    const lower = t.title.toLowerCase().trim();
    return (
      lower.includes("overview") ||
      lower === "sheet1" ||
      lower === "sheet 1"
    );
  });

  if (placeholderTab) {
    let shouldRename = false;
    if (info.tabs.length === 1) {
      shouldRename = true;
    } else {
      try {
        const { headers, rows } = await readTabValues({
          googleAccount,
          spreadsheetId,
          tabTitle: placeholderTab.title,
        });
        if (headers.length === 0 && rows.length === 0) {
          shouldRename = true;
        }
      } catch {
        // If cannot read tab, keep shouldRename as false
      }
    }

    if (shouldRename) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: placeholderTab.sheetId,
                    title: tabTitle,
                  },
                  fields: "title",
                },
              },
            ],
          },
        });
        return { sheetId: placeholderTab.sheetId, created: false, renamed: true };
      } catch (renameErr) {
        console.warn(
          "Could not rename placeholder tab, falling back to adding new tab:",
          renameErr.message
        );
      }
    }
  }

  // Create new worksheet tab if no reusable placeholder tab exists
  const addSheetResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          addSheet: {
            properties: {
              title: tabTitle,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    },
  });

  const newSheetProps = addSheetResponse.data.replies?.[0]?.addSheet?.properties;
  const sheetId = newSheetProps?.sheetId;

  return { sheetId, created: true };
}

/**
 * Locks Column A (Shopify Variant GID) as a Protected Range so users cannot edit it.
 */
export async function protectColumnA({ googleAccount, spreadsheetId, sheetId }) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const sheets = google.sheets({ version: "v4", auth });

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addProtectedRange: {
              protectedRange: {
                range: {
                  sheetId,
                  startRowIndex: 1, // Protect from row 2 downwards (allow header label)
                  startColumnIndex: 0,
                  endColumnIndex: 1, // Column A only
                },
                description: "Protected Shopify Variant ID (Do not edit)",
                warningOnly: false,
                editors: {
                  users: [googleAccount.email],
                },
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    // If permission or already protected, log and don't block
    console.warn("Could not set protected range on Column A:", err.message);
  }
}

/**
 * Batch writes headers and row data to a specified worksheet tab with header styling.
 */
export async function writeTabValues({
  googleAccount,
  spreadsheetId,
  tabTitle,
  headers,
  rows,
}) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const sheets = google.sheets({ version: "v4", auth });

  const values = [headers, ...rows];

  // 1. Clear existing contents of the sheet tab to prevent orphan rows
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tabTitle}'!A1:ZZ`,
  });

  // 2. Batch update cell values
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values,
    },
  });

  return { rowCount: rows.length };
}

/**
 * Reads all rows from a given worksheet tab.
 */
export async function readTabValues({ googleAccount, spreadsheetId, tabTitle }) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabTitle}'!A1:ZZ`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...dataRows] = rows;
  return { headers, rows: dataRows };
}

/**
 * Checks the last modified timestamp of the spreadsheet on Google Drive.
 * Used for detecting concurrent edits before overwriting.
 */
export async function getSpreadsheetModifiedTime({ googleAccount, spreadsheetId }) {
  const auth = await getAuthenticatedOAuthClient(googleAccount);
  const drive = google.drive({ version: "v3", auth });

  try {
    const file = await drive.files.get({
      fileId: spreadsheetId,
      fields: "modifiedTime",
    });
    return file.data.modifiedTime ? new Date(file.data.modifiedTime) : null;
  } catch (error) {
    console.warn("Could not fetch drive modifiedTime:", error.message);
    return null;
  }
}

/**
 * Automatically creates default Inventory and Pricing spreadsheets for a newly connected Google account if none exist.
 */
export async function ensureDefaultSheetsForAccount({ googleAccount, shopName = "Store" }) {
  if (!googleAccount?.id) return [];

  const existingSheets = await getSheetsByGoogleAccountId(googleAccount.id);
  const hasInventory = existingSheets.some((s) => s.type === "INVENTORY");
  const hasPricing = existingSheets.some((s) => s.type === "PRICING");

  if (!hasInventory) {
    try {
      const title = `${shopName} - Inventory Sheet`;
      const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet({
        googleAccount,
        title,
        initialTabTitle: "Inventory Overview",
      });
      await upsertSpreadsheet({
        googleAccountId: googleAccount.id,
        spreadsheetId,
        spreadsheetUrl,
        title,
        type: "INVENTORY",
      });
    } catch (err) {
      console.error("Failed to auto-create inventory sheet:", err.message);
    }
  }

  if (!hasPricing) {
    try {
      const title = `${shopName} - Pricing Sheet`;
      const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet({
        googleAccount,
        title,
        initialTabTitle: "Pricing Overview",
      });
      await upsertSpreadsheet({
        googleAccountId: googleAccount.id,
        spreadsheetId,
        spreadsheetUrl,
        title,
        type: "PRICING",
      });
    } catch (err) {
      console.error("Failed to auto-create pricing sheet:", err.message);
    }
  }

  return getSheetsByGoogleAccountId(googleAccount.id);
}
