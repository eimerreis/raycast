import { Action, ActionPanel, Color, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { ClearSelectedSubscription, ListSubscriptions, SelectSubscription } from "./lib/azure/subscription";

type Props = {
  /** Called after the active subscription changed (selected or reset to the CLI default). */
  onChanged: () => void | Promise<void>;
};

export const SubscriptionList = ({ onChanged }: Props) => {
  const { data, error, isLoading, revalidate } = usePromise(ListSubscriptions, [], { onError: () => {} });
  const activeId = data?.activeId;
  const active = data?.subscriptions.find((subscription) => subscription.id === activeId);

  const change = async (apply: () => Promise<void>, title: string, message?: string) => {
    try {
      await apply();
      await showToast({ style: Toast.Style.Success, title, message });
      await onChanged();
    } catch (e) {
      await showFailureToast(e, { title: "Could not switch subscription" });
    }
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
                <Action
                  title="Use Subscription"
                  icon={Icon.Switch}
                  onAction={() =>
                    change(() => SelectSubscription(subscription.id), "Switched subscription", subscription.name)
                  }
                />
                <Action.CopyToClipboard title="Copy Subscription ID" content={subscription.id} />
                <Action
                  title="Reset to Azure CLI Default"
                  icon={Icon.ArrowCounterClockwise}
                  shortcut={{ key: "r", modifiers: ["cmd", "shift"] }}
                  onAction={() => change(ClearSelectedSubscription, "Using Azure CLI default subscription")}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
};

/** Pushed picker that pops back to the calling view after a change. */
const PushedSubscriptionList = ({ onSwitched }: { onSwitched: () => void }) => {
  const { pop } = useNavigation();
  return (
    <SubscriptionList
      onChanged={() => {
        pop();
        onSwitched();
      }}
    />
  );
};

export const SwitchSubscriptionAction = ({ onSwitched }: { onSwitched: () => void }) => (
  <Action.Push
    title="Switch Subscription"
    icon={Icon.Switch}
    shortcut={{ key: "s", modifiers: ["cmd", "shift"] }}
    target={<PushedSubscriptionList onSwitched={onSwitched} />}
  />
);
