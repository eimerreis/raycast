import { Action, ActionPanel, Clipboard, Color, Detail, Icon, List, showHUD } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import {
  ExportOperationTrace,
  ExportTelemetryList,
  GetTelemetry,
  TelemetryItem,
  TelemetryScope,
  TimeRange,
  timeRanges,
} from "../../lib/azure/app-insights";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { GetResourceUrl } from "../../lib/azure/portal";
import { AzureResource } from "../../lib/azure/resource-graph";
import { WithFailureToast } from "../run-operation";

type Props = {
  app: AzureResource;
  fetchArgs: FetchArgs;
  /** Restricts the list to one operation, e.g. a single Azure Function. */
  operationName?: string;
};

const severities = ["Verbose", "Information", "Warning", "Error", "Critical"];

const ItemIcon = (item: TelemetryItem) => {
  if (item.itemType === "exception") return { source: Icon.Bug, tintColor: Color.Red };
  if (item.itemType === "request")
    return { source: Icon.Globe, tintColor: item.success === false ? Color.Red : Color.Green };
  if (item.itemType === "dependency")
    return { source: Icon.Plug, tintColor: item.success === false ? Color.Orange : Color.SecondaryText };
  if (item.itemType === "customEvent") return { source: Icon.Star, tintColor: Color.Blue };
  const level = item.severityLevel ?? 1;
  return {
    source: Icon.Text,
    tintColor: level >= 3 ? Color.Red : level === 2 ? Color.Orange : Color.SecondaryText,
  };
};

const Fenced = (text: string) => `\`\`\`\n${text.replaceAll("```", "ˋˋˋ")}\n\`\`\``;

const ItemMarkdown = (item: TelemetryItem) =>
  [`### ${item.title.replaceAll("\n", " ").slice(0, 200)}`, item.message ? Fenced(item.message) : ""].join("\n\n");

export const AppInsightsLogs = ({ app, fetchArgs, operationName }: Props) => {
  const appId: string | undefined = app.properties?.AppId;
  const [selection, setSelection] = useState("problems:PT1H");
  const [scope, range] = selection.split(":") as [TelemetryScope, TimeRange];

  // Not cached: telemetry can contain personal data and goes stale quickly.
  const { data, isLoading, error, revalidate } = usePromise(
    (id: string, timeRange: TimeRange, telemetryScope: TelemetryScope, operation?: string) =>
      GetTelemetry(fetchArgs.credential, id, timeRange, { scope: telemetryScope, operationName: operation }),
    [appId ?? "", range, scope, operationName],
    { execute: !!appId },
  );

  const copyTrace = async (operationId: string) => {
    if (!appId) return;
    const trace = await WithFailureToast("Could not export trace", () =>
      ExportOperationTrace(fetchArgs.credential, { appId, name: app.name }, operationId),
    );
    if (!trace) return;
    await Clipboard.copy(JSON.stringify(trace, null, 2));
    await showHUD(`Copied trace with ${trace.itemCount}${trace.truncated ? "+" : ""} items`);
  };

  const rangeTitle = timeRanges.find((item) => item.value === range)?.title ?? range;

  return (
    <List
      navigationTitle={`Logs · ${operationName ?? app.name}`}
      isLoading={isLoading}
      isShowingDetail={!!data?.length}
      searchBarPlaceholder="Filter by message, operation, role..."
      searchBarAccessory={
        <List.Dropdown tooltip="Telemetry and Time Range" value={selection} onChange={setSelection}>
          <List.Dropdown.Section title="Problems (exceptions, failures, warnings)">
            {timeRanges.map((item) => (
              <List.Dropdown.Item
                key={`p-${item.value}`}
                title={`Problems · ${item.title}`}
                value={`problems:${item.value}`}
              />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="All Telemetry">
            {timeRanges.map((item) => (
              <List.Dropdown.Item key={`a-${item.value}`} title={`All · ${item.title}`} value={`all:${item.value}`} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {!appId ? (
        <List.EmptyView icon={Icon.Warning} title="This resource has no Application Insights App ID" />
      ) : error ? (
        <List.EmptyView icon={Icon.Warning} title="Could not query Application Insights" description={error.message} />
      ) : (
        <List.EmptyView
          icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
          title={`No ${scope === "problems" ? "problems" : "telemetry"} in the ${rangeTitle.toLowerCase()}`}
        />
      )}
      {data?.map((item) => (
        <List.Item
          key={`${item.itemType}-${item.itemId}`}
          icon={ItemIcon(item)}
          title={item.title.replaceAll("\n", " ")}
          keywords={[item.itemType, item.operationName ?? "", item.roleName ?? "", item.message ?? ""]}
          accessories={[{ date: new Date(item.timestamp), tooltip: new Date(item.timestamp).toLocaleString() }]}
          detail={
            <List.Item.Detail
              markdown={ItemMarkdown(item)}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Type" text={item.itemType} />
                  <List.Item.Detail.Metadata.Label title="Time" text={new Date(item.timestamp).toLocaleString()} />
                  {item.operationName && (
                    <List.Item.Detail.Metadata.Label title="Operation" text={item.operationName} />
                  )}
                  {item.roleName && <List.Item.Detail.Metadata.Label title="Role" text={item.roleName} />}
                  {item.resultCode && <List.Item.Detail.Metadata.Label title="Result Code" text={item.resultCode} />}
                  {item.duration !== undefined && (
                    <List.Item.Detail.Metadata.Label title="Duration" text={`${Math.round(item.duration)} ms`} />
                  )}
                  {item.severityLevel !== undefined && (
                    <List.Item.Detail.Metadata.Label title="Severity" text={severities[item.severityLevel]} />
                  )}
                  {item.operationId && <List.Item.Detail.Metadata.Label title="Operation ID" text={item.operationId} />}
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              {item.operationId && (
                <Action
                  title="Copy Operation Trace as JSON"
                  icon={Icon.CopyClipboard}
                  onAction={() => copyTrace(item.operationId!)}
                />
              )}
              {item.operationId && (
                <Action.Push
                  title="Show Operation Trace"
                  icon={Icon.List}
                  shortcut={{ key: "t", modifiers: ["cmd", "shift"] }}
                  target={
                    <OperationTrace app={app} appId={appId!} fetchArgs={fetchArgs} operationId={item.operationId} />
                  }
                />
              )}
              <Action.CopyToClipboard
                title="Copy Item as JSON"
                content={JSON.stringify(item, null, 2)}
                shortcut={{ key: "c", modifiers: ["cmd", "shift"] }}
              />
              <Action.CopyToClipboard
                title="Copy All Items as JSON"
                content={JSON.stringify(ExportTelemetryList(app, data, range), null, 2)}
                shortcut={{ key: "j", modifiers: ["cmd", "shift"] }}
              />
              {item.operationId && <Action.CopyToClipboard title="Copy Operation ID" content={item.operationId} />}
              <Action.OpenInBrowser title="Open Logs in Portal" url={GetResourceUrl(app.id, "logs")} />
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

const OperationTrace = ({
  app,
  appId,
  fetchArgs,
  operationId,
}: {
  app: AzureResource;
  appId: string;
  fetchArgs: FetchArgs;
  operationId: string;
}) => {
  const { data, isLoading } = usePromise(
    (id: string) => ExportOperationTrace(fetchArgs.credential, { appId, name: app.name }, id),
    [operationId],
  );
  const json = data ? JSON.stringify(data, null, 2) : "";

  return (
    <Detail
      navigationTitle={`Trace · ${operationId}`}
      isLoading={isLoading}
      markdown={
        data ? `**${data.itemCount} items** in operation \`${operationId}\`\n\n\`\`\`json\n${json}\n\`\`\`` : ""
      }
      actions={
        data && (
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Trace as JSON" content={json} />
          </ActionPanel>
        )
      }
    />
  );
};
