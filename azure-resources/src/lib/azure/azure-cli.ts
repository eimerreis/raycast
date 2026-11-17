import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AccessToken } from "@azure/identity";
import { GetPreferences } from "../preferences";

const execFileAsync = promisify(execFile);

const armResource = "https://management.azure.com";

export class AzureCliError extends Error {
  name = "AzureCliError";
}

export interface AzSubscription {
  id: string;
  name: string;
  isDefault: boolean;
  state: string;
  tenantId: string;
  tenantDisplayName?: string;
  user: {
    name: string;
    type: string;
  };
}

interface AzAccessTokenResponse {
  accessToken: string;
  expiresOn: string;
  expires_on?: number;
}

/**
 * Runs an Azure CLI command and parses its JSON output.
 * Arguments are passed as an array (no shell), so values never need quoting or escaping.
 * Failure is determined by the exit code only: az writes warnings (e.g. available updates) to stderr.
 */
export const az = async <T>(args: string[]): Promise<T> => {
  const { azCliPath } = GetPreferences();
  try {
    const { stdout } = await execFileAsync(azCliPath, [...args, "--output", "json"], {
      maxBuffer: 50 * 1024 * 1024,
    });
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw ToAzureCliError(error, azCliPath);
  }
};

const ToAzureCliError = (error: unknown, azCliPath: string) => {
  const { code, stderr } = error as { code?: string | number; stderr?: string };
  if (code === "ENOENT") {
    return new AzureCliError(`Azure CLI not found at "${azCliPath}". Check the extension preferences.`);
  }
  if (stderr && /az login/i.test(stderr)) {
    return new AzureCliError("Not logged in to the Azure CLI. Run `az login` in a terminal.");
  }
  const message = stderr?.trim() || (error instanceof Error ? error.message : String(error));
  return new AzureCliError(message.replace(/^ERROR:\s*/, ""));
};

export const AzAccountList = () => az<AzSubscription[]>(["account", "list"]);

export const AzAccountShow = (subscriptionId?: string) =>
  az<AzSubscription>(["account", "show", ...(subscriptionId ? ["--subscription", subscriptionId] : [])]);

/**
 * Requests an access token for a resource (ARM by default) in the tenant of the given subscription.
 * Scoping by subscription makes the CLI pick the right tenant.
 */
export const AzGetAccessToken = async (subscriptionId: string, resource = armResource): Promise<AccessToken> => {
  const response = await az<AzAccessTokenResponse>([
    "account",
    "get-access-token",
    "--resource",
    resource,
    "--subscription",
    subscriptionId,
  ]);
  // `expires_on` is a unix timestamp in seconds; older CLI versions only return the local `expiresOn` string.
  const expiresOnTimestamp = response.expires_on ? response.expires_on * 1000 : Date.parse(response.expiresOn);
  return { token: response.accessToken, expiresOnTimestamp, tokenType: "Bearer" };
};
