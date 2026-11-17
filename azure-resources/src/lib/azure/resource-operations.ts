import type { TokenCredential } from "@azure/identity";
import { hostname } from "node:os";
import { ArmAction, ArmGet, ArmList, AzureRequest } from "./arm";
import { GetSecretValue } from "./key-vault";
import { AzureResource, Kql, QueryResourceGraph } from "./resource-graph";

const api = {
  web: "2023-12-01",
  compute: "2024-07-01",
  containerApps: "2024-03-01",
  storage: "2023-05-01",
  sql: "2021-11-01",
  aks: "2024-09-01",
  cdn: "2024-02-01",
};

// --- App Service / Function App -------------------------------------------------------------

export const RestartWebApp = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/restart?api-version=${api.web}`);

export const StartWebApp = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/start?api-version=${api.web}`);

export const StopWebApp = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/stop?api-version=${api.web}`);

export type DeploymentSlot = { id: string; name: string; state?: string; defaultHostName?: string };

export const ListSlots = async (credential: TokenCredential, siteId: string): Promise<DeploymentSlot[]> => {
  const slots = await ArmList<{ id: string; name: string; properties: { state?: string; defaultHostName?: string } }>(
    credential,
    `${siteId}/slots?api-version=${api.web}`,
  );
  return slots.map((slot) => ({
    id: slot.id,
    name: slot.name.split("/").pop() ?? slot.name,
    state: slot.properties.state,
    defaultHostName: slot.properties.defaultHostName,
  }));
};

/** Swaps a deployment slot into production. */
export const SwapSlotIntoProduction = (credential: TokenCredential, slotId: string) =>
  ArmAction(credential, `${slotId}/slotsswap?api-version=${api.web}`, {
    body: { targetSlot: "production", preserveVnet: true },
  });

export type FunctionInfo = { id: string; name: string; invokeUrl?: string; isDisabled: boolean };

export const ListFunctions = async (credential: TokenCredential, siteId: string): Promise<FunctionInfo[]> => {
  const functions = await ArmList<{
    id: string;
    name: string;
    properties: { invoke_url_template?: string; isDisabled?: boolean };
  }>(credential, `${siteId}/functions?api-version=${api.web}`);
  return functions
    .map((fn) => ({
      id: fn.id,
      name: fn.name.split("/").pop() ?? fn.name,
      invokeUrl: fn.properties.invoke_url_template,
      isDisabled: fn.properties.isDisabled ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Resolves `@Microsoft.KeyVault(SecretUri=...)` and `@Microsoft.KeyVault(VaultName=...;SecretName=...)` references. */
const ResolveKeyVaultReference = async (credential: TokenCredential, value: string) => {
  const reference = /^@Microsoft\.KeyVault\((.*)\)$/i.exec(value.trim())?.[1];
  if (!reference) return value;
  const parts = Object.fromEntries(
    reference.split(";").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()];
    }),
  );
  const secretUri: string | undefined =
    parts.secreturi ??
    (parts.vaultname && parts.secretname
      ? `https://${parts.vaultname}.vault.azure.net/secrets/${parts.secretname}/${parts.secretversion ?? ""}`
      : undefined);
  if (!secretUri) return undefined;
  const url = new URL(secretUri);
  const [, , name, version] = url.pathname.split("/");
  return GetSecretValue(credential, url.origin, version ? `${name}/${version}` : name);
};

const componentProjection =
  "project id, name, type, kind, location, resourceGroup, subscriptionId, tags, sku, properties";

/**
 * Finds the Application Insights resource a web/function app reports to:
 * by the instrumentation key in its app settings (resolving Key Vault references),
 * then by the portal's `hidden-link` tag, then by name. Searches all accessible subscriptions.
 */
export const FindLinkedAppInsights = async (
  credential: TokenCredential,
  site: AzureResource,
): Promise<AzureResource | undefined> => {
  const { json } = await AzureRequest<{ properties: Record<string, string> }>(
    credential,
    `${site.id}/config/appsettings/list?api-version=${api.web}`,
    { method: "POST" },
  );
  const settings = (await json()).properties ?? {};
  const rawConnectionString = settings.APPLICATIONINSIGHTS_CONNECTION_STRING;
  const connectionString = rawConnectionString
    ? await ResolveKeyVaultReference(credential, rawConnectionString).catch(() => undefined)
    : undefined;
  const instrumentationKey =
    /InstrumentationKey=([^;]+)/i.exec(connectionString ?? "")?.[1] ?? settings.APPINSIGHTS_INSTRUMENTATIONKEY;

  const match = instrumentationKey
    ? `properties.InstrumentationKey =~ ${Kql(instrumentationKey)}`
    : `isnotempty(tags[${Kql(`hidden-link:${site.id}`)}]) or name =~ ${Kql(site.name)}`;
  const [component] = await QueryResourceGraph<AzureResource>(
    credential,
    [],
    [
      "resources",
      "| where type =~ 'microsoft.insights/components'",
      `| where ${match}`,
      "| take 1",
      `| ${componentProjection}`,
    ].join("\n"),
  );
  return component;
};

// --- Virtual Machine -------------------------------------------------------------------------

export const StartVm = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/start?api-version=${api.compute}`);

/** Stops and deallocates, so compute is no longer billed. */
export const DeallocateVm = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/deallocate?api-version=${api.compute}`);

export const RestartVm = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/restart?api-version=${api.compute}`);

export type VmAddresses = { privateIps: string[]; publicIps: string[] };

export const GetVmAddresses = async (credential: TokenCredential, vm: AzureResource): Promise<VmAddresses> => {
  const rows = await QueryResourceGraph<{ privateIp?: string; publicIp?: string }>(
    credential,
    [vm.subscriptionId],
    [
      "resources",
      "| where type =~ 'microsoft.network/networkinterfaces'",
      `| where properties.virtualMachine.id =~ ${Kql(vm.id)}`,
      "| mv-expand ipconfig = properties.ipConfigurations",
      "| project privateIp = tostring(ipconfig.properties.privateIPAddress), publicIpId = tolower(tostring(ipconfig.properties.publicIPAddress.id))",
      "| join kind=leftouter (resources | where type =~ 'microsoft.network/publicipaddresses'",
      "    | project publicIpId = tolower(id), publicIp = tostring(properties.ipAddress)) on publicIpId",
      "| project privateIp, publicIp",
    ].join("\n"),
  );
  return {
    privateIps: rows.map((row) => row.privateIp).filter((ip): ip is string => !!ip),
    publicIps: rows.map((row) => row.publicIp).filter((ip): ip is string => !!ip),
  };
};

// --- Container App ---------------------------------------------------------------------------

export type Revision = {
  id: string;
  name: string;
  active: boolean;
  createdTime?: string;
  trafficWeight?: number;
  replicas?: number;
  healthState?: string;
  runningState?: string;
};

export const ListRevisions = async (credential: TokenCredential, appId: string): Promise<Revision[]> => {
  const revisions = await ArmList<{
    id: string;
    name: string;
    properties: {
      active: boolean;
      createdTime?: string;
      trafficWeight?: number;
      replicas?: number;
      healthState?: string;
      runningState?: string;
    };
  }>(credential, `${appId}/revisions?api-version=${api.containerApps}`);
  return revisions
    .map((revision) => ({ id: revision.id, name: revision.name, ...revision.properties }))
    .sort((a, b) => (b.createdTime ?? "").localeCompare(a.createdTime ?? ""));
};

export const RestartRevision = (credential: TokenCredential, revisionId: string) =>
  ArmAction(credential, `${revisionId}/restart?api-version=${api.containerApps}`);

// --- Storage ---------------------------------------------------------------------------------

export type BlobContainer = { id: string; name: string; publicAccess?: string; lastModified?: string };

export const ListContainers = async (credential: TokenCredential, accountId: string): Promise<BlobContainer[]> => {
  const containers = await ArmList<{
    id: string;
    name: string;
    properties: { publicAccess?: string; lastModifiedTime?: string };
  }>(credential, `${accountId}/blobServices/default/containers?api-version=${api.storage}`);
  return containers.map((container) => ({
    id: container.id,
    name: container.name,
    publicAccess: container.properties.publicAccess,
    lastModified: container.properties.lastModifiedTime,
  }));
};

// --- SQL -------------------------------------------------------------------------------------

const GetPublicIp = async () => {
  const response = await fetch("https://api.ipify.org?format=json");
  if (!response.ok) throw new Error("Could not determine your public IP address");
  return ((await response.json()) as { ip: string }).ip;
};

/** Creates or updates a firewall rule named after this machine that allows the current public IP. */
export const AllowCurrentIpOnSqlServer = async (credential: TokenCredential, serverId: string) => {
  const ip = await GetPublicIp();
  const ruleName = `raycast-${hostname().replace(/[^A-Za-z0-9-_]/g, "-")}`.slice(0, 128);
  await AzureRequest(credential, `${serverId}/firewallRules/${ruleName}?api-version=${api.sql}`, {
    method: "PUT",
    body: { properties: { startIpAddress: ip, endIpAddress: ip } },
  });
  return { ip, ruleName };
};

// --- AKS -------------------------------------------------------------------------------------

export const StartAks = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/start?api-version=${api.aks}`);

export const StopAks = (credential: TokenCredential, id: string) =>
  ArmAction(credential, `${id}/stop?api-version=${api.aks}`);

// --- Front Door / CDN ------------------------------------------------------------------------

/** Works for Front Door Standard/Premium (`afdEndpoints`) and classic CDN (`endpoints`) endpoints. */
export const PurgeEndpoint = (credential: TokenCredential, endpointId: string, paths = ["/*"]) =>
  ArmAction(credential, `${endpointId}/purge?api-version=${api.cdn}`, { body: { contentPaths: paths } });

export const GetResource = <T>(credential: TokenCredential, id: string, apiVersion: string) =>
  ArmGet<T>(credential, `${id}?api-version=${apiVersion}`);
