import type { AccessToken, TokenCredential } from "@azure/identity";
import { AzGetAccessToken } from "./azure-cli";

const refreshMarginMs = 5 * 60 * 1000;

/**
 * Credential backed by `az account get-access-token`.
 * The token is kept in memory only and fetched again shortly before it expires.
 */
export const CreateAzureCliCredential = (subscriptionId: string): TokenCredential => {
  let pending: Promise<AccessToken> | undefined;

  return {
    getToken: async () => {
      const current = pending && (await pending.catch(() => undefined));
      if (current && current.expiresOnTimestamp - Date.now() > refreshMarginMs) {
        return current;
      }
      pending = AzGetAccessToken(subscriptionId);
      return pending;
    },
  };
};
