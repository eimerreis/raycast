import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import { useState } from "react";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { GetResourceUrl } from "../../lib/azure/portal";
import { AzureResource } from "../../lib/azure/resource-graph";
import {
  DeadLetterMessage,
  GetServiceBusEntities,
  PeekDeadLetters,
  ServiceBusEntity,
} from "../../lib/azure/service-bus";

type Filter = "dead-letters" | "all";

type Props = {
  namespaces: AzureResource[];
  fetchArgs: FetchArgs;
  isLoadingNamespaces?: boolean;
  extraActions?: JSX.Element;
};

export const ServiceBusEntities = ({ namespaces, fetchArgs, isLoadingNamespaces, extraActions }: Props) => {
  const [filter, setFilter] = useState<Filter>("dead-letters");
  const { data, isLoading, revalidate } = useCachedPromise(
    async (namespaceIds: string[]) => {
      const selected = namespaces.filter((namespace) => namespaceIds.includes(namespace.id));
      const entities = await Promise.all(
        selected.map((namespace) => GetServiceBusEntities(fetchArgs.credential, namespace)),
      );
      return entities.flat();
    },
    [namespaces.map((namespace) => namespace.id)],
    { execute: namespaces.length > 0 },
  );

  const visible = (data ?? [])
    .filter((entity) => filter === "all" || entity.deadLetterCount > 0)
    .sort((a, b) => b.deadLetterCount - a.deadLetterCount || a.path.localeCompare(b.path));
  const byNamespace = new Map<string, ServiceBusEntity[]>();
  for (const entity of visible) {
    byNamespace.set(entity.namespace, [...(byNamespace.get(entity.namespace) ?? []), entity]);
  }

  return (
    <List
      navigationTitle={namespaces.length === 1 ? `Service Bus · ${namespaces[0].name}` : "Service Bus Dead Letters"}
      isLoading={isLoading || isLoadingNamespaces}
      searchBarPlaceholder="Search queues and subscriptions..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" value={filter} onChange={(value) => setFilter(value as Filter)}>
          <List.Dropdown.Item title="With Dead Letters" value="dead-letters" />
          <List.Dropdown.Item title="All Queues and Subscriptions" value="all" />
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          <Action title="Show All Entities" icon={Icon.List} onAction={() => setFilter("all")} />
          {extraActions}
        </ActionPanel>
      }
    >
      <List.EmptyView
        icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
        title={filter === "dead-letters" ? "No dead letters" : "No queues or subscriptions"}
      />
      {[...byNamespace.entries()].map(([namespace, entities]) => (
        <List.Section key={namespace} title={namespace} subtitle={`${entities.length}`}>
          {entities.map((entity) => (
            <EntityItem
              key={entity.id}
              entity={entity}
              fetchArgs={fetchArgs}
              refresh={revalidate}
              extraActions={extraActions}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
};

const EntityItem = ({
  entity,
  fetchArgs,
  refresh,
  extraActions,
}: {
  entity: ServiceBusEntity;
  fetchArgs: FetchArgs;
  refresh: () => void;
  extraActions?: JSX.Element;
}) => (
  <List.Item
    icon={entity.kind === "queue" ? Icon.Tray : Icon.Megaphone}
    title={entity.path}
    subtitle={entity.kind === "queue" ? "Queue" : "Subscription"}
    keywords={[entity.namespace, entity.entityName]}
    accessories={[
      { text: `${entity.activeCount} active`, tooltip: "Active messages" },
      {
        tag: {
          value: `${entity.deadLetterCount} dead`,
          color: entity.deadLetterCount > 0 ? Color.Red : Color.SecondaryText,
        },
        tooltip: "Dead-lettered messages",
      },
    ]}
    actions={
      <ActionPanel>
        <Action.Push
          title="Peek Dead Letters"
          icon={Icon.Eye}
          target={<DeadLetterMessages entity={entity} fetchArgs={fetchArgs} />}
        />
        <Action.OpenInBrowser title="Open in Portal" url={GetResourceUrl(entity.id)} />
        <Action.CopyToClipboard title="Copy Entity Path" content={entity.path} />
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={{ key: "r", modifiers: ["cmd"] }}
          onAction={refresh}
        />
        {extraActions}
      </ActionPanel>
    }
  />
);

const ToMarkdown = (message: DeadLetterMessage) => {
  const body = typeof message.body === "string" ? message.body : JSON.stringify(message.body, null, 2);
  const language = typeof message.body === "string" ? "" : "json";
  return [
    `**${message.deadLetterReason ?? "Dead-lettered"}**`,
    message.deadLetterErrorDescription ?? "",
    "",
    `\`\`\`${language}\n${body}\n\`\`\``,
  ].join("\n");
};

/** Peeks only; messages stay in the dead-letter queue. */
const DeadLetterMessages = ({ entity, fetchArgs }: { entity: ServiceBusEntity; fetchArgs: FetchArgs }) => {
  // Not cached: message bodies can contain customer data.
  const { data, isLoading, error, revalidate } = usePromise(PeekDeadLetters, [fetchArgs.credential, entity]);
  const exportAll = () =>
    JSON.stringify(
      {
        source: "Azure Service Bus dead-letter queue",
        namespace: entity.namespace,
        entity: entity.path,
        messages: data,
      },
      null,
      2,
    );

  return (
    <List navigationTitle={`Dead Letters · ${entity.path}`} isLoading={isLoading} isShowingDetail={!!data?.length}>
      {error ? (
        <List.EmptyView
          icon={Icon.Lock}
          title="Could not peek messages"
          description={`${error.message}\n\nPeeking requires the "Azure Service Bus Data Receiver" role.`}
        />
      ) : (
        <List.EmptyView icon={{ source: Icon.CheckCircle, tintColor: Color.Green }} title="No dead-lettered messages" />
      )}
      {data?.map((message) => (
        <List.Item
          key={message.sequenceNumber}
          title={message.deadLetterReason ?? message.messageId ?? message.sequenceNumber}
          keywords={[message.messageId ?? "", message.subject ?? "", message.deadLetterErrorDescription ?? ""]}
          detail={
            <List.Item.Detail
              markdown={ToMarkdown(message)}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Message ID" text={message.messageId} />
                  <List.Item.Detail.Metadata.Label title="Sequence Number" text={message.sequenceNumber} />
                  <List.Item.Detail.Metadata.Label
                    title="Enqueued"
                    text={message.enqueuedTime ? new Date(message.enqueuedTime).toLocaleString() : undefined}
                  />
                  <List.Item.Detail.Metadata.Label title="Delivery Count" text={String(message.deliveryCount ?? "")} />
                  {message.subject && <List.Item.Detail.Metadata.Label title="Subject" text={message.subject} />}
                  {message.correlationId && (
                    <List.Item.Detail.Metadata.Label title="Correlation ID" text={message.correlationId} />
                  )}
                  {Object.entries(message.applicationProperties ?? {}).map(([key, value]) => (
                    <List.Item.Detail.Metadata.Label key={key} title={key} text={String(value)} />
                  ))}
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Message as JSON" content={JSON.stringify(message, null, 2)} />
              <Action.CopyToClipboard
                title="Copy All Messages as JSON"
                content={exportAll()}
                shortcut={{ key: "j", modifiers: ["cmd", "shift"] }}
              />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                shortcut={{ key: "r", modifiers: ["cmd"] }}
                onAction={revalidate}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};
