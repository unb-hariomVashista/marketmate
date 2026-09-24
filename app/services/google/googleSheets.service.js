import { google } from "googleapis";
import { getAuthenticatedOAuthClient } from "./googleAuth.service";

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

  return {
    spreadsheetId: sheetData.spreadsheetId,
    spreadsheetUrl: sheetData.spreadsheetUrl,
    initialSheetId,
  };
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

  // Create new worksheet tab
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
