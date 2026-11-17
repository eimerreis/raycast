import type { TokenCredential } from "@azure/identity";
import { ArmGet, ArmList } from "./arm";

const keyVaultResource = "https://vault.azure.net";
const apiVersion = "7.4";

export type SecretInfo = {
  id: string;
  name: string;
  enabled: boolean;
  updated?: Date;
  contentType?: string;
};

type SecretItem = { id: string; contentType?: string; attributes: { enabled: boolean; updated?: number } };

const VaultUrl = (vaultUri: string) => vaultUri.replace(/\/+$/, "");

/** Lists secret names and metadata only; values are never loaded here. */
export const ListSecrets = async (credential: TokenCredential, vaultUri: string): Promise<SecretInfo[]> => {
  const items = await ArmList<SecretItem>(
    credential,
    `${VaultUrl(vaultUri)}/secrets?api-version=${apiVersion}&maxresults=25`,
    keyVaultResource,
  );
  return items
    .map((item) => ({
      id: item.id,
      name: item.id.split("/").pop() ?? item.id,
      enabled: item.attributes.enabled,
      updated: item.attributes.updated ? new Date(item.attributes.updated * 1000) : undefined,
      contentType: item.contentType,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const GetSecretValue = async (credential: TokenCredential, vaultUri: string, name: string) => {
  const secret = await ArmGet<{ value: string }>(
    credential,
    `${VaultUrl(vaultUri)}/secrets/${encodeURIComponent(name)}?api-version=${apiVersion}`,
    keyVaultResource,
  );
  return secret.value;
};
