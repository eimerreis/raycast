import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { ActivityLogEntry, ActivityLogScope, GetActivityLog } from "../../lib/azure/activity-log";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { GetResourceUrl } from "../../lib/azure/portal";

const ranges = [
  { hours: 1, title: "Last Hour" },
  { hours: 6, title: "Last 6 Hours" },
  { hours: 24, title: "Last 24 Hours" },
  { hours: 72, title: "Last 3 Days" },
  { hours: 168, title: "Last 7 Days" },
];

const StatusIcon = (entry: ActivityLogEntry) => {
  const status = entry.status.toLowerCase();
  if (status === "succeeded") return { source: Icon.CheckCircle, tintColor: Color.Green };
  if (status === "failed") return { source: Icon.XMarkCircle, tintColor: Color.Red };
  return { source: Icon.Clock, tintColor: Color.Orange };
};

type Props = {
  fetchArgs: FetchArgs;
  scope?: ActivityLogScope;
  /** Shown in the navigation title, e.g. the resource or group name. */
  title?: string;
  extraActions?: JSX.Element;
};

export const ActivityLogList = ({ fetchArgs, scope = {}, title, extraActions }: Props) => {
  const [hours, setHours] = useState(24);
  const { data, isLoading, revalidate } = useCachedPromise(
    (subscriptionId: string, rangeHours: number, resourceGroup?: string, resourceId?: string) =>
      GetActivityLog(fetchArgs.credential, subscriptionId, rangeHours, { resourceGroup, resourceId }),
    [fetchArgs.subscriptionId, hours, scope.resourceGroup, scope.resourceId],
    { keepPreviousData: true },
  );

  return (
    <List
      navigationTitle={`Activity Log · ${title ?? fetchArgs.subscriptionName}`}
      isLoading={isLoading}
      searchBarPlaceholder="Filter by operation, caller, resource..."
      searchBarAccessory={
        <List.Dropdown tooltip="Time Range" value={String(hours)} onChange={(value) => setHours(Number(value))}>
          {ranges.map((range) => (
            <List.Dropdown.Item key={range.hours} title={range.title} value={String(range.hours)} />
          ))}
        </List.Dropdown>
      }
    >
      <List.EmptyView icon={Icon.Clock} title="No activity in this time range" />
      {data?.map((entry) => {
        const resourceName = entry.resourceId?.split("/").pop();
        return (
          <List.Item
            key={`${entry.id}-${entry.correlationId}`}
            icon={StatusIcon(entry)}
            title={entry.operation}
            subtitle={scope.resourceId ? undefined : resourceName}
            keywords={[entry.caller ?? "", entry.resourceGroup ?? "", entry.status, resourceName ?? ""]}
            accessories={[
              ...(entry.caller ? [{ text: entry.caller, icon: Icon.Person }] : []),
              { date: new Date(entry.timestamp), tooltip: new Date(entry.timestamp).toLocaleString() },
            ]}
            actions={
              <ActionPanel>
                {entry.resourceId && (
                  <Action.OpenInBrowser title="Open Resource in Portal" url={GetResourceUrl(entry.resourceId)} />
                )}
                <Action.CopyToClipboard
                  title="Copy Entry as JSON"
                  content={JSON.stringify(entry, null, 2)}
                  shortcut={{ key: "j", modifiers: ["cmd", "shift"] }}
                />
                <Action.CopyToClipboard title="Copy Correlation ID" content={entry.correlationId} />
                {entry.message && <Action.CopyToClipboard title="Copy Status Message" content={entry.message} />}
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ key: "r", modifiers: ["cmd"] }}
                  onAction={revalidate}
                />
                {extraActions}
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
};
