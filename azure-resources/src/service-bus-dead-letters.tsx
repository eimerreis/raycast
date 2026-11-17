import { useCachedPromise } from "@raycast/utils";
import { ServiceBusEntities } from "./components/views/service-bus-entities";
import { ListResourcesOfType } from "./lib/azure/resource-graph";
import { SwitchSubscriptionAction } from "./subscription-list";
import { PropsWithFetchArgs, withFetchArgs } from "./with-fetch-args";

const ServiceBusDeadLettersCommand = ({ fetchArgs, reloadFetchArgs }: PropsWithFetchArgs) => {
  const { data: namespaces, isLoading } = useCachedPromise(
    (subscriptionId: string) =>
      ListResourcesOfType(fetchArgs.credential, [subscriptionId], "microsoft.servicebus/namespaces"),
    [fetchArgs.subscriptionId],
  );

  return (
    <ServiceBusEntities
      namespaces={namespaces ?? []}
      fetchArgs={fetchArgs}
      isLoadingNamespaces={isLoading}
      extraActions={<SwitchSubscriptionAction onSwitched={reloadFetchArgs} />}
    />
  );
};

export default withFetchArgs(ServiceBusDeadLettersCommand);
