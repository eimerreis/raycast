import type { TokenCredential } from "@azure/identity";
import { AzureRequest } from "./arm";

/** A resource as returned by Azure Resource Graph. `type` is always lower case. */
export type AzureResource = {
  id: string;
  name: string;
  type: string;
  kind?: string;
  location?: string;
  resourceGroup: string;
  subscriptionId: string;
  tags?: Record<string, string> | null;
  sku?: { name?: string; tier?: string } | null;
  // Resource Graph returns the full ARM `properties` bag; its shape depends on the resource type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any> | null;
};

export type AzureResourceGroup = {
  id: string;
  name: string;
  location: string;
  subscriptionId: string;
  tags?: Record<string, string> | null;
};

type GraphResponse<T> = { data: T[]; $skipToken?: string };

const graphUrl = "/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01";
const maxPages = 5;

/** KQL string literal. */
export const Kql = (value: string) => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

const resourceProjection =
  "project id, name, type, kind, location, resourceGroup, subscriptionId, tags, sku, properties";

export const QueryResourceGraph = async <T>(credential: TokenCredential, subscriptions: string[], query: string) => {
  const result: T[] = [];
  let skipToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const { json } = await AzureRequest<GraphResponse<T>>(credential, graphUrl, {
      method: "POST",
      // Without subscriptions, Resource Graph searches every subscription the token can access.
      body: {
        ...(subscriptions.length ? { subscriptions } : {}),
        query,
        options: { resultFormat: "objectArray", $top: 1000, $skipToken: skipToken },
      },
    });
    const response = await json();
    result.push(...response.data);
    skipToken = response.$skipToken;
    if (!skipToken) break;
  }
  return result;
};

export type SearchOptions = {
  text?: string;
  type?: string;
  resourceGroup?: string;
  limit?: number;
};

export const SearchResources = (credential: TokenCredential, subscriptions: string[], options: SearchOptions) => {
  const text = options.text?.trim();
  const filters = [
    text && `| where name contains ${Kql(text)}`,
    options.type
      ? `| where type =~ ${Kql(options.type)}`
      : "| where type !~ 'microsoft.compute/virtualmachines/extensions'",
    options.resourceGroup && `| where resourceGroup =~ ${Kql(options.resourceGroup)}`,
  ].filter(Boolean);
  const query = [
    "resources",
    ...filters,
    text ? `| extend rank = iff(name startswith ${Kql(text)}, 0, 1)` : "| extend rank = 0",
    "| order by rank asc, name asc",
    `| take ${options.limit ?? 200}`,
    `| ${resourceProjection}`,
  ].join("\n");
  return QueryResourceGraph<AzureResource>(credential, subscriptions, query);
};

export const GetResourcesByIds = (credential: TokenCredential, subscriptions: string[], ids: string[]) =>
  QueryResourceGraph<AzureResource>(
    credential,
    subscriptions,
    `resources | where id in~ (${ids.map(Kql).join(", ")}) | ${resourceProjection}`,
  );

export const GetResourceByName = async (credential: TokenCredential, subscriptions: string[], name: string) => {
  const [resource] = await QueryResourceGraph<AzureResource>(
    credential,
    subscriptions,
    `resources | where name =~ ${Kql(name)} | take 1 | ${resourceProjection}`,
  );
  return resource;
};

export const ListResourcesOfType = (credential: TokenCredential, subscriptions: string[], type: string) =>
  SearchResources(credential, subscriptions, { type, limit: 1000 });

export const GetResourceGroups = (credential: TokenCredential, subscriptions: string[]) =>
  QueryResourceGraph<AzureResourceGroup>(
    credential,
    subscriptions,
    [
      "resourcecontainers",
      "| where type == 'microsoft.resources/subscriptions/resourcegroups'",
      "| project id, name, location, subscriptionId, tags",
      "| order by name asc",
    ].join("\n"),
  );
