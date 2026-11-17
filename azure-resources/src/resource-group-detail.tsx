import { List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { ResourceListItem } from "./components/resource-list-item";
import { GetResourceType } from "./components/resource-types";
import { FetchArgs } from "./lib/azure/get-fetch-args";
import { AzureResource, SearchResources } from "./lib/azure/resource-graph";

type Props = {
  groupName: string;
  fetchArgs: FetchArgs;
};

export const ResourceGroupDetail = ({ groupName, fetchArgs }: Props) => {
  // Subscription and group are hook arguments so each group has its own cache entry.
  const {
    data: resources,
    isLoading,
    revalidate,
  } = useCachedPromise(
    (subscriptionId: string, resourceGroup: string) =>
      SearchResources(fetchArgs.credential, [subscriptionId], { resourceGroup, limit: 1000 }),
    [fetchArgs.subscriptionId, groupName],
  );

  const sections = new Map<string, AzureResource[]>();
  for (const resource of resources ?? []) {
    const label = GetResourceType(resource).label;
    sections.set(label, [...(sections.get(label) ?? []), resource]);
  }

  return (
    <List
      navigationTitle={`${groupName} · ${fetchArgs.subscriptionName}`}
      isLoading={isLoading}
      searchBarPlaceholder="Search Resources..."
    >
      {[...sections.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, items]) => (
          <List.Section key={label} title={label} subtitle={`${items.length}`}>
            {items.map((resource) => (
              <ResourceListItem key={resource.id} resource={resource} fetchArgs={fetchArgs} refresh={revalidate} />
            ))}
          </List.Section>
        ))}
    </List>
  );
};
