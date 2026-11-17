import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { AzureResourceGroup, GetResourceGroups } from "./lib/azure/resource-graph";
import { GetResourceUrl } from "./lib/azure/portal";
import { PropsWithFetchArgs, withFetchArgs } from "./with-fetch-args";
import { ResourceGroupDetail } from "./resource-group-detail";
import { SwitchSubscriptionAction } from "./subscription-list";
import { ActivityLogList } from "./components/views/activity-log-list";

const ListResourceGroups = ({ fetchArgs, reloadFetchArgs }: PropsWithFetchArgs) => {
  // The subscription id is a hook argument so cached results never leak across subscriptions.
  const { data: groups, isLoading } = useCachedPromise(
    (subscriptionId: string) => GetResourceGroups(fetchArgs.credential, [subscriptionId]),
    [fetchArgs.subscriptionId],
  );
  const { data: sortedData, visitItem } = useFrecencySorting<AzureResourceGroup>(groups, {
    key: (item) => item.id,
  });

  return (
    <List
      navigationTitle={`Subscription: ${fetchArgs.subscriptionName}`}
      isLoading={isLoading}
      searchBarPlaceholder="Search Resource Groups..."
      actions={
        <ActionPanel>
          <SwitchSubscriptionAction onSwitched={reloadFetchArgs} />
        </ActionPanel>
      }
    >
      {sortedData.map((group) => (
        <List.Item
          key={group.id}
          icon={Icon.Folder}
          title={group.name}
          subtitle={group.location}
          keywords={Object.values(group.tags ?? {})}
          actions={
            <ActionPanel>
              <Action.Push
                title="View Resources"
                icon={Icon.List}
                onPush={() => visitItem(group)}
                target={<ResourceGroupDetail groupName={group.name} fetchArgs={fetchArgs} />}
              />
              <Action.OpenInBrowser
                title="Open in Portal"
                shortcut={{ key: "o", modifiers: ["cmd"] }}
                onOpen={() => visitItem(group)}
                url={GetResourceUrl(group.id)}
              />
              <Action.Push
                title="Show Activity Log"
                icon={Icon.Clock}
                shortcut={{ key: "a", modifiers: ["cmd", "shift"] }}
                onPush={() => visitItem(group)}
                target={
                  <ActivityLogList fetchArgs={fetchArgs} scope={{ resourceGroup: group.name }} title={group.name} />
                }
              />
              <Action.CopyToClipboard
                title="Copy Name"
                content={group.name}
                shortcut={{ key: "c", modifiers: ["cmd", "opt"] }}
              />
              <ActionPanel.Section>
                <SwitchSubscriptionAction onSwitched={reloadFetchArgs} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};

export default withFetchArgs(ListResourceGroups);
