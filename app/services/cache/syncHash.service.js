import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.resolve(process.cwd(), "storage", "sync_hashes");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheFilePath(shop, tabTitle) {
  ensureCacheDir();
  const safeShop = (shop || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTab = (tabTitle || "tab").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `${safeShop}__${safeTab}.json`);
}

/**
 * Computes MD5 hash of an inventory row state.
 */
export function computeInventoryRowHash(identifier, quantity) {
  const content = `${String(identifier || "").trim().toLowerCase()}::${String(quantity ?? "").trim()}`;
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Computes MD5 hash of a pricing row state.
 */
export function computePricingRowHash(identifier, marketPrice, compareAtPrice) {
  const p = parseFloat(marketPrice);
  const c = parseFloat(compareAtPrice);
  const cleanPrice = isNaN(p) ? "" : p.toFixed(2);
  const cleanCompare = isNaN(c) ? "" : c.toFixed(2);
  const content = `${String(identifier || "").trim().toLowerCase()}::${cleanPrice}::${cleanCompare}`;
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Retrieves cached row hashes for a given shop and sheet tab.
 * Returns null if no cache exists yet.
 */
export async function getStoredTabHashes(shop, tabTitle) {
  try {
    const filePath = getCacheFilePath(shop, tabTitle);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[syncHash] Failed to read tab hashes:", err.message);
    return null;
  }
}

/**
 * Saves or merges row hashes for a given shop and sheet tab.
 */
export async function saveStoredTabHashes(shop, tabTitle, newHashesMap, merge = true) {
  try {
    const filePath = getCacheFilePath(shop, tabTitle);
    let finalMap = newHashesMap;

    if (merge && fs.existsSync(filePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        finalMap = { ...existing, ...newHashesMap };
      } catch {
        // ignore parse error, use newHashesMap
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(finalMap, null, 2), "utf-8");
  } catch (err) {
    console.warn("[syncHash] Failed to write tab hashes:", err.message);
  }
}
