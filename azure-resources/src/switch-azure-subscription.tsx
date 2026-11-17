import { popToRoot } from "@raycast/api";
import { SubscriptionList } from "./subscription-list";

export default function SwitchAzureSubscription() {
  return <SubscriptionList onChanged={() => popToRoot({ clearSearchBar: true })} />;
}
