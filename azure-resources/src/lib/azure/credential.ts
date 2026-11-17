import type { AccessToken, TokenCredential } from "@azure/identity";
import { AzGetAccessToken } from "./azure-cli";

const refreshMarginMs = 5 * 60 * 1000;

/** Turns OAuth scopes (`https://vault.azure.net/.default`) into the resource the Azure CLI expects. */
const ScopeToResource = (scopes: string | string[]) => {
  const scope = Array.isArray(scopes) ? scopes[0] : scopes;
  return scope.replace(/\/\.default$/, "").replace(/\/+$/, "");
};

/**
 * Credential backed by `az account get-access-token`.
 * Works for any Azure resource (ARM, Key Vault, Service Bus, Application Insights).
 * Tokens are kept in memory only, per resource, and fetched again shortly before they expire.
 */
export const CreateAzureCliCredential = (subscriptionId: string): TokenCredential => {
  const pending = new Map<string, Promise<AccessToken>>();

  return {
    getToken: async (scopes) => {
      const resource = ScopeToResource(scopes);
      const current = await pending.get(resource)?.catch(() => undefined);
      if (current && current.expiresOnTimestamp - Date.now() > refreshMarginMs) {
        return current;
      }
      const next = AzGetAccessToken(subscriptionId, resource);
      pending.set(resource, next);
      return next;
    },
  };
};

export const GetBearerToken = async (credential: TokenCredential, resource: string) => {
  const token = await credential.getToken(`${resource}/.default`);
  if (!token) {
    throw new Error(`Could not get an access token for ${resource}`);
  }
  return token.token;
};
