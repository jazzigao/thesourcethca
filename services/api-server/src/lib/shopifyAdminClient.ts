const ADMIN_API_PATH = "/admin/api/2026-04/graphql.json";
const FETCH_TIMEOUT_MS = 15_000;

function getConnectorConfig() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !token) {
    throw new Error("Shopify connection environment is unavailable.");
  }

  const protocol = hostname.startsWith("localhost") ? "http" : "https";
  return {
    url: `${protocol}://${hostname}/api/v2/proxy${ADMIN_API_PATH}`,
    token,
  };
}

export async function shopifyAdminRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { url, token } = getConnectorConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Replit-Token": token,
      "Connector-Name": "shopify-store",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const text = await response.text();
  const body = text ? safeJsonParse(text) : {};
  if (!response.ok || body.errors?.length) {
    throw new Error(
      `Shopify Admin API request failed (${response.status}): ${JSON.stringify(body.errors ?? body)}`,
    );
  }

  return body.data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { errors: [{ message: text }] };
  }
}