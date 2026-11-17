import { LocalStorage } from "@raycast/api";
import { AzAccountList, AzAccountShow, AzSubscription } from "./azure-cli";

/**
 * The extension keeps its own active subscription so switching never changes the Azure CLI default.
 * Without a selection, the CLI default subscription is used.
 */
const selectedSubscriptionKey = "selected-subscription-id";

export const GetSelectedSubscriptionId = () => LocalStorage.getItem<string>(selectedSubscriptionKey);

export const SelectSubscription = (subscriptionId: string) =>
  LocalStorage.setItem(selectedSubscriptionKey, subscriptionId);

export const ClearSelectedSubscription = () => LocalStorage.removeItem(selectedSubscriptionKey);

export const ResolveActiveSubscription = async (): Promise<AzSubscription> => {
  const selectedId = await GetSelectedSubscriptionId();
  if (!selectedId) {
    return AzAccountShow();
  }

  const subscriptions = await AzAccountList();
  const selected = subscriptions.find((subscription) => subscription.id === selectedId);
  if (selected) {
    return selected;
  }

  // The selected subscription is gone (logged out, removed access): fall back to the CLI default.
  await ClearSelectedSubscription();
  return AzAccountShow();
};

/**
 * Lists all subscriptions and marks the one the extension currently uses.
 */
export const ListSubscriptions = async () => {
  const [subscriptions, selectedId] = await Promise.all([AzAccountList(), GetSelectedSubscriptionId()]);
  const active =
    subscriptions.find((subscription) => subscription.id === selectedId) ??
    subscriptions.find((subscription) => subscription.isDefault);
  return { subscriptions, activeId: active?.id };
};
