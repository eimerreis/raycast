import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCachedPromise, useCachedState, usePromise } from "@raycast/utils";
import { useState } from "react";
import { ResourceListItem } from "./components/resource-list-item";
import { filterableTypes } from "./components/resource-types";
import { SearchResources } from "./lib/azure/resource-graph";
import { ListSubscriptions } from "./lib/azure/subscription";
import { SwitchSubscriptionAction } from "./subscription-list";
import { PropsWithFetchArgs, withFetchArgs } from "./with-fetch-args";

const allTypes = "all";

const SearchResourcesCommand = ({ fetchArgs, reloadFetchArgs }: PropsWithFetchArgs) => {
  const [searchText, setSearchText] = useState("");
  const [type, setType] = useCachedState("search-resources-type", allTypes);
  const [allSubscriptions, setAllSubscriptions] = useCachedState("search-resources-all-subscriptions", false);

  // Subscriptions of the active tenant, for tenant-wide search and for naming each result's subscription.
  const { data: tenantSubscriptions } = usePromise(
    async (tenantId: string) =>
      (await ListSubscriptions()).subscriptions.filter(
        (subscription) => subscription.tenantId === tenantId && subscription.state === "Enabled",
      ),
    [fetchArgs.tenantId],
  );
  const scope = allSubscriptions
    ? (tenantSubscriptions?.map((subscription) => subscription.id) ?? [])
    : [fetchArgs.subscriptionId];

  const { data, isLoading, revalidate } = useCachedPromise(
    (subscriptions: string[], text: string, resourceType: string) =>
      SearchResources(fetchArgs.credential, subscriptions, {
        text,
        type: resourceType === allTypes ? undefined : resourceType,
        limit: 200,
      }),
    [scope, searchText, type],
    { keepPreviousData: true, execute: scope.length > 0 },
  );

  const subscriptionName = (id: string) =>
    tenantSubscriptions?.find((subscription) => subscription.id === id)?.name ?? fetchArgs.subscriptionName;

  const extraActions = (
    <>
      <Action
        title={allSubscriptions ? "Search Active Subscription Only" : "Search All Subscriptions in Tenant"}
        icon={Icon.Globe}
        shortcut={{ key: "a", modifiers: ["cmd", "opt"] }}
        onAction={() => setAllSubscriptions(!allSubscriptions)}
      />
      <SwitchSubscriptionAction onSwitched={reloadFetchArgs} />
    </>
  );

  return (
    <List
      navigationTitle={
        allSubscriptions ? "Search Resources · All Subscriptions" : `Search Resources · ${fetchArgs.subscriptionName}`
      }
      isLoading={isLoading}
      filtering={false}
      throttle
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search resources by name..."
      searchBarAccessory={
        <List.Dropdown tooltip="Resource Type" value={type} onChange={setType}>
          <List.Dropdown.Item title="All Types" value={allTypes} />
          <List.Dropdown.Section>
            {filterableTypes.map((item) => (
              <List.Dropdown.Item key={item.type} title={item.label} value={item.type} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      actions={<ActionPanel>{extraActions}</ActionPanel>}
    >
      <List.EmptyView icon={Icon.MagnifyingGlass} title="No matching resources" />
      {data?.map((resource) => (
        <ResourceListItem
          key={resource.id}
          resource={resource}
          fetchArgs={{
            ...fetchArgs,
            subscriptionId: resource.subscriptionId,
            subscriptionName: subscriptionName(resource.subscriptionId),
          }}
          refresh={revalidate}
          showLocation
          showSubscription={allSubscriptions}
          extraActions={extraActions}
        />
      ))}
    </List>
  );
};

export default withFetchArgs(SearchResourcesCommand);
