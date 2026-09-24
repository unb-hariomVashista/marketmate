import prisma from "../db.server";

/**
 * Retrieves all spreadsheets belonging to a Google Account, optionally filtered by type (PRICING or INVENTORY).
 */
export async function getSheetsByGoogleAccountId(googleAccountId, type = null) {
  if (!googleAccountId) return [];

  const where = { googleAccountId };
  if (type) {
    where.type = type;
  }

  return prisma.appSpreadsheet.findMany({
    where,
    include: {
      tabs: true,
      syncJobs: {
        orderBy: { startedAt: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Finds a spreadsheet by internal database ID.
 */
export async function getSpreadsheetById(id) {
  if (!id) return null;

  return prisma.appSpreadsheet.findUnique({
    where: { id },
    include: {
      tabs: true,
      googleAccount: true,
    },
  });
}

/**
 * Finds a spreadsheet by Google Account ID and Google's internal spreadsheetId.
 */
export async function getSpreadsheetByGoogleId(googleAccountId, spreadsheetId) {
  if (!googleAccountId || !spreadsheetId) return null;

  return prisma.appSpreadsheet.findUnique({
    where: {
      googleAccountId_spreadsheetId: {
        googleAccountId,
        spreadsheetId,
      },
    },
    include: {
      tabs: true,
    },
  });
}

/**
 * Registers or updates a spreadsheet linked to a Google account.
 */
export async function upsertSpreadsheet({
  googleAccountId,
  spreadsheetId,
  spreadsheetUrl,
  title,
  type,
}) {
  return prisma.appSpreadsheet.upsert({
    where: {
      googleAccountId_spreadsheetId: {
        googleAccountId,
        spreadsheetId,
      },
    },
    create: {
      googleAccountId,
      spreadsheetId,
      spreadsheetUrl,
      title,
      type,
    },
    update: {
      title,
      spreadsheetUrl,
      type,
    },
    include: {
      tabs: true,
    },
  });
}

/**
 * Adds or updates a tab mapped to a specific Shop + Market.
 */
export async function upsertSheetTab({
  spreadsheetId,
  shop,
  marketId,
  marketName,
  tabTitle,
  tabGid = null,
}) {
  return prisma.sheetTab.upsert({
    where: {
      spreadsheetId_tabTitle: {
        spreadsheetId,
        tabTitle,
      },
    },
    create: {
      spreadsheetId,
      shop,
      marketId,
      marketName,
      tabTitle,
      tabGid,
    },
    update: {
      shop,
      marketId,
      marketName,
      tabGid: tabGid ?? undefined,
    },
  });
}

/**
 * Updates the lastSyncedAt timestamp for a tab.
 */
export async function updateTabLastSynced(tabId) {
  return prisma.sheetTab.update({
    where: { id: tabId },
    data: { lastSyncedAt: new Date() },
  });
}

/**
 * Retrieves all tabs for a given spreadsheet and store.
 */
export async function getTabsForShopAndSpreadsheet(shop, spreadsheetId) {
  return prisma.sheetTab.findMany({
    where: {
      shop,
      spreadsheetId,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Deletes a spreadsheet record.
 */
export async function deleteSpreadsheet(id) {
  return prisma.appSpreadsheet.delete({
    where: { id },
  });
}
