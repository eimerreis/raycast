import { Action, ActionPanel, Detail, Icon, List } from "@raycast/api";
import { useCallback } from "react";
import { FetchArgs } from "../lib/azure/get-fetch-args";
import { GetResourceUrl } from "../lib/azure/portal";
import { AzureResource } from "../lib/azure/resource-graph";
import { RecordVisit } from "../lib/recent-resources";
import { GetResourceType } from "./resource-types";
import { ResourceContext } from "./resource-types/types";
import { ActivityLogList } from "./views/activity-log-list";

type Props = {
  resource: AzureResource;
  fetchArgs: FetchArgs;
  refresh: () => void;
  /** Shows the resource group (and subscription) next to the name, for lists that span groups. */
  showLocation?: boolean;
  showSubscription?: boolean;
  /** Extra actions appended at the end, e.g. switching the subscription or removing from recents. */
  extraActions?: JSX.Element;
};

export const ResourceListItem = ({
  resource,
  fetchArgs,
  refresh,
  showLocation,
  showSubscription,
  extraActions,
}: Props) => {
  const definition = GetResourceType(resource);
  const status = definition.status?.(resource);
  const visit = useCallback(() => {
    RecordVisit(resource, fetchArgs);
  }, [resource, fetchArgs]);

  return (
    <List.Item
      icon={definition.icon}
      title={resource.name}
      subtitle={definition.label}
      keywords={[definition.label, resource.resourceGroup, resource.type, ...Object.values(resource.tags ?? {})]}
      accessories={[
        ...(status ? [{ tag: { value: status.value, color: status.color } }] : []),
        ...(showLocation ? [{ text: resource.resourceGroup, icon: Icon.Folder, tooltip: "Resource group" }] : []),
        ...(showSubscription ? [{ text: fetchArgs.subscriptionName, tooltip: "Subscription" }] : []),
      ]}
      actions={
        <ResourceActions
          context={{ resource, fetchArgs, visit, refresh }}
          extraActions={extraActions}
          showDetailsAction
        />
      }
    />
  );
};

export const ResourceActions = ({
  context,
  extraActions,
  showDetailsAction,
}: {
  context: ResourceContext;
  extraActions?: JSX.Element;
  showDetailsAction?: boolean;
}) => {
  const { resource, fetchArgs, visit, refresh } = context;
  const definition = GetResourceType(resource);
  const TypeActions = definition.Actions;

  return (
    <ActionPanel title={resource.name}>
      {TypeActions && <TypeActions {...context} />}
      <ActionPanel.Section title="Resource">
        <Action.OpenInBrowser
          title="Open in Portal"
          url={GetResourceUrl(resource.id)}
          shortcut={{ key: "o", modifiers: ["cmd"] }}
          onOpen={visit}
        />
        {showDetailsAction && (
          <Action.Push
            title="Show Details"
            icon={Icon.Info}
            shortcut={{ key: "i", modifiers: ["cmd"] }}
            target={<ResourceDetail context={context} />}
            onPush={visit}
          />
        )}
        <Action.Push
          title="Show Activity Log"
          icon={Icon.Clock}
          shortcut={{ key: "a", modifiers: ["cmd", "shift"] }}
          target={<ActivityLogList fetchArgs={fetchArgs} scope={{ resourceId: resource.id }} title={resource.name} />}
          onPush={visit}
        />
        <Action.CopyToClipboard
          title="Copy Resource ID"
          content={resource.id}
          shortcut={{ key: "c", modifiers: ["cmd", "shift"] }}
          onCopy={visit}
        />
        <Action.CopyToClipboard
          title="Copy Name"
          content={resource.name}
          shortcut={{ key: "c", modifiers: ["cmd", "opt"] }}
          onCopy={visit}
        />
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={{ key: "r", modifiers: ["cmd"] }}
          onAction={refresh}
        />
      </ActionPanel.Section>
      {extraActions && <ActionPanel.Section>{extraActions}</ActionPanel.Section>}
    </ActionPanel>
  );
};

const maxPropertiesLength = 6000;

const ResourceDetail = ({ context }: { context: ResourceContext }) => {
  const { resource, fetchArgs } = context;
  const definition = GetResourceType(resource);
  const status = definition.status?.(resource);
  const tags = Object.entries(resource.tags ?? {});
  const properties = JSON.stringify(resource.properties ?? {}, null, 2);
  const truncated =
    properties.length > maxPropertiesLength ? `${properties.slice(0, maxPropertiesLength)}\n… (truncated)` : properties;

  return (
    <Detail
      navigationTitle={resource.name}
      markdown={`# ${resource.name}\n\n**Properties**\n\n\`\`\`json\n${truncated}\n\`\`\``}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Type" text={definition.label} icon={definition.icon} />
          {status && (
            <Detail.Metadata.TagList title="Status">
              <Detail.Metadata.TagList.Item text={status.value} color={status.color} />
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.Label title="Resource Group" text={resource.resourceGroup} />
          <Detail.Metadata.Label title="Subscription" text={fetchArgs.subscriptionName} />
          <Detail.Metadata.Label title="Location" text={resource.location} />
          {resource.kind && <Detail.Metadata.Label title="Kind" text={resource.kind} />}
          {resource.sku?.name && <Detail.Metadata.Label title="SKU" text={resource.sku.name} />}
          {tags.length > 0 && (
            <Detail.Metadata.TagList title="Tags">
              {tags.map(([key, value]) => (
                <Detail.Metadata.TagList.Item key={key} text={value ? `${key}: ${value}` : key} />
              ))}
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="ARM Type" text={resource.type} />
          <Detail.Metadata.Label title="ID" text={resource.id} />
        </Detail.Metadata>
      }
      actions={<ResourceActions context={context} />}
    />
  );
};
