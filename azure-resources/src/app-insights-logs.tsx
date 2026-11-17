import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { AppInsightsLogs } from "./components/views/app-insights-logs";
import { GetResourceUrl } from "./lib/azure/portal";
import { AzureResource, ListResourcesOfType } from "./lib/azure/resource-graph";
import { SwitchSubscriptionAction } from "./subscription-list";
import { PropsWithFetchArgs, withFetchArgs } from "./with-fetch-args";

const AppInsightsCommand = ({ fetchArgs, reloadFetchArgs }: PropsWithFetchArgs) => {
  const { data, isLoading } = useCachedPromise(
    (subscriptionId: string) =>
      ListResourcesOfType(fetchArgs.credential, [subscriptionId], "microsoft.insights/components"),
    [fetchArgs.subscriptionId],
  );
  const { data: sorted, visitItem } = useFrecencySorting<AzureResource>(data, {
    namespace: "app-insights",
    key: (item) => item.id,
  });

  return (
    <List
      navigationTitle={`App Insights · ${fetchArgs.subscriptionName}`}
      isLoading={isLoading}
      searchBarPlaceholder="Search Application Insights..."
      actions={
        <ActionPanel>
          <SwitchSubscriptionAction onSwitched={reloadFetchArgs} />
        </ActionPanel>
      }
    >
      <List.EmptyView icon={Icon.LineChart} title="No Application Insights in this subscription" />
      {sorted.map((app) => (
        <List.Item
          key={app.id}
          icon={Icon.LineChart}
          title={app.name}
          subtitle={app.resourceGroup}
          accessories={[{ text: app.location }]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Logs"
                icon={Icon.Bug}
                onPush={() => visitItem(app)}
                target={<AppInsightsLogs app={app} fetchArgs={fetchArgs} />}
              />
              <Action.OpenInBrowser
                title="Open in Portal"
                url={GetResourceUrl(app.id)}
                shortcut={{ key: "o", modifiers: ["cmd"] }}
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

export default withFetchArgs(AppInsightsCommand);
