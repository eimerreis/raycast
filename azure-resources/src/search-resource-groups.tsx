import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { ResourceGroup } from "@azure/arm-resources";
import { GetResourceGroups, GetResourceUrl } from "./lib/azure/azure";
import { PropsWithFetchArgs, withFetchArgs } from "./with-fetch-args";
import { ResourceGroupDetail } from "./resource-group-detail";
import { SwitchSubscriptionAction } from "./subscription-list";

const ListResourceGroups: React.FC<PropsWithFetchArgs> = ({ fetchArgs, reloadFetchArgs }) => {
  // The subscription id is a hook argument so cached results never leak across subscriptions.
  const { data: groups, isLoading } = useCachedPromise(
    (subscriptionId: string) => GetResourceGroups({ ...fetchArgs, subscriptionId }),
    [fetchArgs.subscriptionId],
  );
  const { data: sortedData, visitItem } = useFrecencySorting<ResourceGroup>(groups, {
    key: (item) => item.id ?? item.name ?? "",
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
          title={group.name ?? "Unknown Group"}
          subtitle={group.location}
          actions={
            <ActionPanel>
              <Action.Push
                title="View Resources"
                icon={Icon.List}
                onPush={() => visitItem(group)}
                target={<ResourceGroupDetail groupName={group.name ?? ""} fetchArgs={fetchArgs} />}
              />
              {group.id && (
                <Action.OpenInBrowser
                  title="Open in Portal"
                  onOpen={() => visitItem(group)}
                  url={GetResourceUrl(group.id)}
                />
              )}
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
