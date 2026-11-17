import { Action, Alert, confirmAlert, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { ResourceListItem } from "./components/resource-list-item";
import { CreateFetchArgs, FetchArgs } from "./lib/azure/get-fetch-args";
import { GetResourcesByIds } from "./lib/azure/resource-graph";
import { ClearRecentResources, GetRecentResources, RecentResource, RemoveRecentResource } from "./lib/recent-resources";

type Entry = RecentResource & { fetchArgs: FetchArgs };

/**
 * Recent resources across all subscriptions and tenants.
 * Stored snapshots render immediately; status and properties are refreshed from Resource Graph.
 */
const LoadRecent = async (refresh: boolean): Promise<Entry[]> => {
  const recent = await GetRecentResources();
  const fetchArgsBySubscription = new Map<string, FetchArgs>();
  const entries = recent.map((entry) => {
    const { subscriptionId } = entry.resource;
    if (!fetchArgsBySubscription.has(subscriptionId)) {
      fetchArgsBySubscription.set(
        subscriptionId,
        CreateFetchArgs({ id: subscriptionId, name: entry.subscriptionName, tenantId: entry.tenantId }),
      );
    }
    return { ...entry, fetchArgs: fetchArgsBySubscription.get(subscriptionId)! };
  });
  if (!refresh) return entries;

  const fresh = await Promise.all(
    [...fetchArgsBySubscription.values()].map((fetchArgs) =>
      GetResourcesByIds(
        fetchArgs.credential,
        [fetchArgs.subscriptionId],
        entries
          .filter((entry) => entry.resource.subscriptionId === fetchArgs.subscriptionId)
          .map((entry) => entry.resource.id),
      ).catch(() => []),
    ),
  );
  const byId = new Map(fresh.flat().map((resource) => [resource.id.toLowerCase(), resource]));
  return entries.map((entry) => ({ ...entry, resource: byId.get(entry.resource.id.toLowerCase()) ?? entry.resource }));
};

export default function RecentResourcesCommand() {
  const snapshot = usePromise(LoadRecent, [false]);
  const live = usePromise(LoadRecent, [true]);
  const data = live.data ?? snapshot.data;

  const refresh = () => {
    snapshot.revalidate();
    live.revalidate();
  };

  return (
    <List isLoading={snapshot.isLoading || live.isLoading} searchBarPlaceholder="Search recent resources...">
      <List.EmptyView
        icon={Icon.Clock}
        title="No recent resources yet"
        description="Resources you open or act on in the other commands show up here."
      />
      {data?.map((entry) => (
        <ResourceListItem
          key={entry.resource.id}
          resource={entry.resource}
          fetchArgs={entry.fetchArgs}
          refresh={refresh}
          showLocation
          showSubscription
          extraActions={
            <>
              <Action
                title="Remove from Recent"
                icon={Icon.MinusCircle}
                shortcut={{ key: "x", modifiers: ["ctrl"] }}
                onAction={async () => {
                  await RemoveRecentResource(entry.resource.id);
                  refresh();
                }}
              />
              <Action
                title="Clear All Recent Resources"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ key: "x", modifiers: ["ctrl", "shift"] }}
                onAction={async () => {
                  if (
                    await confirmAlert({
                      title: "Clear all recent resources?",
                      primaryAction: { title: "Clear", style: Alert.ActionStyle.Destructive },
                    })
                  ) {
                    await ClearRecentResources();
                    refresh();
                  }
                }}
              />
            </>
          }
        />
      ))}
    </List>
  );
}
