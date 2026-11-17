import { Color, Image } from "@raycast/api";
import { AzureResource } from "../../lib/azure/resource-graph";
import { FetchArgs } from "../../lib/azure/get-fetch-args";

export type ResourceContext = {
  resource: AzureResource;
  fetchArgs: FetchArgs;
  /** Records the resource as recently used. Call from every action. */
  visit: () => void;
  /** Reloads the list, e.g. after a state change like starting a VM. */
  refresh: () => void;
};

export type ResourceStatus = { value: string; color: Color };

export type ResourceTypeDefinition = {
  /** Lower-case ARM type, e.g. `microsoft.web/sites`. */
  type: string;
  /** Optional narrower match on `kind`, e.g. Function Apps share their type with App Services. */
  matchesKind?: (kind: string) => boolean;
  label: string;
  icon: Image.ImageLike;
  status?: (resource: AzureResource) => ResourceStatus | undefined;
  /** Type-specific actions. The first one becomes the primary (↵) action. */
  Actions?: (context: ResourceContext) => JSX.Element;
};
