import { Icon } from "@raycast/api";
import { AzureResource } from "../../lib/azure/resource-graph";
import { kubernetesCluster, virtualMachine } from "./compute";
import { containerApp } from "./containers";
import { cosmosDb, keyVault, redisCache, sqlDatabase, sqlServer, storageAccount } from "./data";
import { appInsights, cdnEndpoint, frontDoorEndpoint, serviceBusNamespace } from "./other";
import { ResourceTypeDefinition } from "./types";
import { appService, functionApp, staticWebApp } from "./web";

/** Order matters: definitions with a `matchesKind` must come before the generic one of the same type. */
export const resourceTypes: ResourceTypeDefinition[] = [
  functionApp,
  appService,
  staticWebApp,
  virtualMachine,
  containerApp,
  kubernetesCluster,
  storageAccount,
  keyVault,
  sqlServer,
  sqlDatabase,
  cosmosDb,
  redisCache,
  serviceBusNamespace,
  appInsights,
  frontDoorEndpoint,
  cdnEndpoint,
];

const fallback = (resource: AzureResource): ResourceTypeDefinition => ({
  type: resource.type,
  label: resource.type.split("/").slice(1).join("/") || resource.type,
  icon: Icon.Box,
});

export const GetResourceType = (resource: AzureResource): ResourceTypeDefinition =>
  resourceTypes.find(
    (definition) =>
      definition.type === resource.type.toLowerCase() &&
      (!definition.matchesKind || definition.matchesKind(resource.kind ?? "")),
  ) ?? fallback(resource);

/** Types offered in the type filter (Function Apps and App Services share one ARM type). */
export const filterableTypes = resourceTypes
  .filter((definition) => definition !== functionApp)
  .map((definition) => ({
    type: definition.type,
    label: definition === appService ? "App Service / Function App" : definition.label,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
