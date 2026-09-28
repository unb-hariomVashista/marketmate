/**
 * Executes a Shopify GraphQL query/mutation with automatic throttle detection,
 * exponential backoff, and bucket recovery retries.
 */
export async function executeGraphQLWithRetry(admin, queryOrMutation, options = {}, maxRetries = 6) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = await admin.graphql(queryOrMutation, options);

      // Handle HTTP 429 Too Many Requests
      if (response.status === 429) {
        const retryAfter = response.headers?.get?.("Retry-After");
        const delayMs = retryAfter ? Math.ceil(parseFloat(retryAfter)) * 1000 : 1500 * attempt;
        console.warn(`[Shopify GraphQL] HTTP 429 Throttled. Waiting ${delayMs}ms before retry ${attempt}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        if (response.status >= 500) {
          console.warn(`[Shopify GraphQL] HTTP ${response.status} server error, retrying in ${1000 * attempt}ms...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw jsonErr;
      }

      // Check for GraphQL top-level "THROTTLED" error
      const isThrottled = data?.errors?.some((e) =>
        e?.message?.toLowerCase().includes("throttled") ||
        e?.extensions?.code === "THROTTLED"
      );

      if (isThrottled) {
        const restoreRate = data?.extensions?.cost?.throttleStatus?.restoreRate || 50;
        const requestedCost = data?.extensions?.cost?.requestedQueryCost || 100;
        const currentlyAvailable = data?.extensions?.cost?.throttleStatus?.currentlyAvailable || 0;
        const pointsNeeded = Math.max(requestedCost - currentlyAvailable, 50);
        const waitTime = Math.min(Math.max(Math.ceil((pointsNeeded / restoreRate) * 1000), 1000 * attempt), 6000);

        console.warn(`[Shopify GraphQL] Rate limit bucket throttled. Waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      return data;
    } catch (err) {
      const errMsg = err?.message?.toLowerCase() || "";
      if ((errMsg.includes("throttled") || errMsg.includes("rate limit") || errMsg.includes("fetch failed")) && attempt < maxRetries) {
        const waitTime = 1500 * attempt;
        console.warn(`[Shopify GraphQL] Network/throttle exception: ${err.message}. Retrying in ${waitTime}ms...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Shopify GraphQL rate limit exceeded after maximum retry attempts.");
}
