import prisma from "../db.server";

/**
 * Creates a new SyncJob log entry.
 */
export async function createSyncJob({
  spreadsheetId,
  shop,
  marketId = null,
  type,
  direction,
  status = "IN_PROGRESS",
  summary = null,
}) {
  return prisma.syncJob.create({
    data: {
      spreadsheetId,
      shop,
      marketId,
      type,
      direction,
      status,
      summary,
    },
  });
}

/**
 * Updates an ongoing or completed sync job.
 */
export async function updateSyncJob(id, { status, summary, errorLogs, completed = false }) {
  return prisma.syncJob.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(summary !== undefined ? { summary } : {}),
      ...(errorLogs !== undefined ? { errorLogs } : {}),
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });
}

/**
 * Checks if there is an ongoing sync job for the given spreadsheet and shop/market.
 */
export async function getActiveSyncJob({ spreadsheetId, shop, marketId = null }) {
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
  return prisma.syncJob.findFirst({
    where: {
      spreadsheetId,
      shop,
      ...(marketId ? { marketId } : {}),
      status: "IN_PROGRESS",
      startedAt: { gte: threeMinutesAgo },
    },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Retrieves recent sync history for a store.
 */
export async function getRecentSyncJobsByShop(shop, limit = 10) {
  return prisma.syncJob.findMany({
    where: { shop },
    include: {
      spreadsheet: {
        select: {
          title: true,
          type: true,
          spreadsheetUrl: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
