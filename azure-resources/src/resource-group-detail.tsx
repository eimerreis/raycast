import { Action, ActionPanel, List, Detail, Icon } from "@raycast/api";
import { useCachedPromise, useFrecencySorting } from "@raycast/utils";
import { GenericResourceExpanded } from "@azure/arm-resources";
import { GetResourcesInResourceGroup, GetResourceUrl } from "./lib/azure/azure";
import { PropsWithFetchArgs } from "./with-fetch-args";
import { GetPreferences } from "./lib/preferences";

type Props = {
  groupName: string;
} & Pick<PropsWithFetchArgs, "fetchArgs">;

export const ResourceGroupDetail: React.FC<Props> = ({ groupName, fetchArgs }) => {
  const { showResourceDetailsInList } = GetPreferences();
  // Subscription and group are hook arguments so each group has its own cache entry.
  const { data: resources, isLoading } = useCachedPromise(
    (subscriptionId: string, name: string) => GetResourcesInResourceGroup(name, { ...fetchArgs, subscriptionId }),
    [fetchArgs.subscriptionId, groupName],
  );
  const { data: sortedData, visitItem } = useFrecencySorting(resources, {
    key: (item) => item.id ?? item.name ?? "",
  });

  return (
    <List
      navigationTitle={`${groupName} · ${fetchArgs.subscriptionName}`}
      isShowingDetail={showResourceDetailsInList}
      isLoading={isLoading}
      searchBarPlaceholder="Search Resources..."
    >
      {sortedData.map((resource) => (
        <List.Item
          key={resource.id}
          title={resource.name ?? "Unknown Resource"}
          subtitle={showResourceDetailsInList ? undefined : resource.type}
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="ID" text={resource.id} />
                  <List.Item.Detail.Metadata.Label title="Name" text={resource.name} />
                  <List.Item.Detail.Metadata.Label title="Type" text={resource.type} />
                  <List.Item.Detail.Metadata.Label title="Location" text={resource.location} />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Kind" text={resource.kind} />
                  <List.Item.Detail.Metadata.Label title="SKU" text={resource.sku?.name} />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel title={resource.name}>
              {resource.id && (
                <Action.OpenInBrowser
                  onOpen={() => visitItem(resource)}
                  title="Open in Portal"
                  url={GetResourceUrl(resource.id)}
                />
              )}
              <Action.Push
                onPush={() => visitItem(resource)}
                title="Show Resource Details"
                target={<AzureResourceDetails resource={resource} />}
                icon={Icon.Info}
              />
              {resource.id && (
                <Action.CopyToClipboard
                  onCopy={() => visitItem(resource)}
                  shortcut={{ key: "c", modifiers: ["cmd", "shift"] }}
                  title="Copy Resource ID"
                  content={resource.id}
                />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};

const AzureResourceDetails = ({ resource }: { resource: GenericResourceExpanded }) => (
  <Detail
    navigationTitle={resource.name}
    markdown={`# ${resource.name ?? "Resource"}`}
    metadata={
      <Detail.Metadata>
        <Detail.Metadata.Label title="ID" text={resource.id} />
        <Detail.Metadata.Label title="Name" text={resource.name} />
        <Detail.Metadata.Label title="Type" text={resource.type} />
        <Detail.Metadata.Label title="Location" text={resource.location} />
        <Detail.Metadata.Separator />
        {resource.kind && <Detail.Metadata.Label title="Kind" text={resource.kind} />}
        {resource.sku?.name && <Detail.Metadata.Label title="SKU" text={resource.sku.name} />}
      </Detail.Metadata>
    }
    actions={
      resource.id && (
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Portal" url={GetResourceUrl(resource.id)} />
          <Action.CopyToClipboard title="Copy Resource ID" content={resource.id} />
        </ActionPanel>
      )
    }
  />
);
