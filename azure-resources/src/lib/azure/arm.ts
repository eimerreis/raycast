import type { TokenCredential } from "@azure/identity";
import { GetBearerToken } from "./credential";

export const armEndpoint = "https://management.azure.com";

const pollTimeoutMs = 10 * 60 * 1000;

export class AzureRequestError extends Error {
  name = "AzureRequestError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer token audience; defaults to Azure Resource Manager. */
  resource?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ErrorMessage = async (response: Response) => {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    // Query APIs nest the useful detail (e.g. a KQL syntax error) in `innererror`.
    let inner = json.error?.innererror;
    while (inner?.innererror) inner = inner.innererror;
    const message = json.error?.message ?? json.message ?? json.error?.code ?? text;
    return inner?.message ? `${message}: ${inner.message}` : message;
  } catch {
    return text || response.statusText;
  }
};

/**
 * Sends an authenticated request to an Azure endpoint.
 * `url` is either absolute or an ARM path (`/subscriptions/...?api-version=...`).
 */
export const AzureRequest = async <T>(credential: TokenCredential, url: string, options: RequestOptions = {}) => {
  const resource = options.resource ?? armEndpoint;
  const token = await GetBearerToken(credential, resource);
  const response = await fetch(url.startsWith("https://") ? url : `${armEndpoint}${url}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new AzureRequestError(await ErrorMessage(response), response.status);
  }

  return { response, json: async () => ParseJson<T>(await response.text()) };
};

const ParseJson = <T>(text: string) => (text ? (JSON.parse(text) as T) : (undefined as T));

export const ArmGet = async <T>(credential: TokenCredential, url: string, resource?: string) =>
  (await AzureRequest<T>(credential, url, { resource })).json();

/** Follows `nextLink` pages and returns all items. */
export const ArmList = async <T>(credential: TokenCredential, url: string, resource?: string) => {
  const items: T[] = [];
  let next: string | undefined = url;
  while (next) {
    const page: { value: T[]; nextLink?: string } = await ArmGet(credential, next, resource);
    items.push(...(page.value ?? []));
    next = page.nextLink;
  }
  return items;
};

/**
 * Runs an ARM action and waits for long-running operations (202 + Azure-AsyncOperation / Location).
 */
export const ArmAction = async <T = unknown>(
  credential: TokenCredential,
  url: string,
  options: Omit<RequestOptions, "resource"> = {},
): Promise<T> => {
  const { response, json } = await AzureRequest<T>(credential, url, { method: "POST", ...options });
  if (response.status !== 202 && response.status !== 201) {
    return json();
  }

  const asyncOperation = response.headers.get("Azure-AsyncOperation");
  const location = response.headers.get("Location");
  const startedAt = Date.now();

  while (Date.now() - startedAt < pollTimeoutMs) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? 3);
    await sleep(Math.min(Math.max(retryAfter, 2), 15) * 1000);

    if (asyncOperation) {
      const status = await ArmGet<{ status: string; error?: { message?: string } }>(credential, asyncOperation);
      if (status.status === "Succeeded") return undefined as T;
      if (status.status === "Failed" || status.status === "Canceled") {
        throw new Error(status.error?.message ?? `Operation ${status.status.toLowerCase()}`);
      }
    } else if (location) {
      const poll = await AzureRequest<T>(credential, location);
      if (poll.response.status !== 202) return poll.json();
    } else {
      return undefined as T;
    }
  }

  throw new Error("Operation is still running. Check the Azure Portal for its status.");
};
