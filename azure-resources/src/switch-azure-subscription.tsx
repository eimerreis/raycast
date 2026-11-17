import { Action, ActionPanel, Color, Icon, List, popToRoot, showToast, Toast } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { AzSubscription } from "./lib/azure/azure-cli";
import { ClearSelectedSubscription, ListSubscriptions, SelectSubscription } from "./lib/azure/subscription";

export default function SwitchAzureSubscription() {
  const { data, error, isLoading, revalidate } = usePromise(ListSubscriptions, [], { onError: () => {} });
  const activeId = data?.activeId;
  const active = data?.subscriptions.find((subscription) => subscription.id === activeId);

  const onSelect = async (subscription: AzSubscription) => {
    try {
      await SelectSubscription(subscription.id);
      await showToast({ style: Toast.Style.Success, title: "Switched subscription", message: subscription.name });
      await popToRoot({ clearSearchBar: true });
    } catch (e) {
      await showFailureToast(e, { title: "Could not switch subscription" });
    }
  };

  const onReset = async () => {
    await ClearSelectedSubscription();
    await showToast({ style: Toast.Style.Success, title: "Using Azure CLI default subscription" });
    revalidate();
  };

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="Could not load Azure subscriptions"
          description={error.message}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      navigationTitle={active ? `Subscription: ${active.name}` : "Switch Azure Subscription"}
      isLoading={isLoading}
      searchBarPlaceholder="Search subscriptions..."
    >
      {data?.subscriptions.map((subscription) => {
        const isActive = subscription.id === activeId;
        return (
          <List.Item
            key={subscription.id}
            icon={isActive ? { source: Icon.CheckCircle, tintColor: Color.Green } : Icon.Circle}
            title={subscription.name}
            subtitle={subscription.tenantDisplayName ?? subscription.tenantId}
            keywords={[subscription.id, subscription.tenantId]}
            accessories={[
              ...(subscription.isDefault ? [{ tag: "CLI default" }] : []),
              ...(subscription.state !== "Enabled"
                ? [{ tag: { value: subscription.state, color: Color.Orange } }]
                : []),
            ]}
            actions={
              <ActionPanel>
                <Action title="Use Subscription" icon={Icon.Switch} onAction={() => onSelect(subscription)} />
                <Action.CopyToClipboard title="Copy Subscription ID" content={subscription.id} />
                <Action
                  title="Reset to Azure CLI Default"
                  icon={Icon.ArrowCounterClockwise}
                  shortcut={{ key: "r", modifiers: ["cmd", "shift"] }}
                  onAction={onReset}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
