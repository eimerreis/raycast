import { GenericResourceExpanded, ResourceGroup, ResourceManagementClient } from "@azure/arm-resources";
import type { TokenCredential } from "@azure/identity";

export type FetchArgs = {
  credential: TokenCredential;
  subscriptionId: string;
  subscriptionName: string;
};

const CreateResourceManagementClient = (args: FetchArgs) =>
  new ResourceManagementClient(args.credential, args.subscriptionId);

const Collect = async <T>(items: AsyncIterable<T>) => {
  const result: T[] = [];
  for await (const item of items) {
    result.push(item);
  }
  return result;
};

export const GetResourceGroups = (args: FetchArgs): Promise<ResourceGroup[]> =>
  Collect(CreateResourceManagementClient(args).resourceGroups.list());

export const GetResourcesInResourceGroup = (name: string, args: FetchArgs): Promise<GenericResourceExpanded[]> =>
  Collect(CreateResourceManagementClient(args).resources.listByResourceGroup(name));

/** OData string literals escape a single quote by doubling it. */
const ODataString = (value: string) => `'${value.replaceAll("'", "''")}'`;

export const GetResourceByName = async (name: string, args: FetchArgs) => {
  const client = CreateResourceManagementClient(args);
  for await (const resource of client.resources.list({ filter: `name eq ${ODataString(name)}` })) {
    return resource;
  }
};

export const GetResourceUrl = (resourceId: string) => `https://portal.azure.com/#resource${resourceId}`;
