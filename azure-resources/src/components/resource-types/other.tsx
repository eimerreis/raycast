import { Action, Icon } from "@raycast/api";
import { GetResourceUrl } from "../../lib/azure/portal";
import { PurgeEndpoint } from "../../lib/azure/resource-operations";
import { RunOperation } from "../run-operation";
import { AppInsightsLogs } from "../views/app-insights-logs";
import { ServiceBusEntities } from "../views/service-bus-entities";
import { ResourceContext, ResourceTypeDefinition } from "./types";

// --- Service Bus -----------------------------------------------------------------------------

export const serviceBusNamespace: ResourceTypeDefinition = {
  type: "microsoft.servicebus/namespaces",
  label: "Service Bus",
  icon: Icon.Tray,
  Actions: ({ resource, fetchArgs, visit }: ResourceContext) => {
    const endpoint: string | undefined = resource.properties?.serviceBusEndpoint;
    return (
      <>
        <Action.Push
          title="Show Queues and Dead Letters"
          icon={Icon.Tray}
          target={<ServiceBusEntities namespaces={[resource]} fetchArgs={fetchArgs} />}
          onPush={visit}
        />
        {endpoint && (
          <Action.CopyToClipboard
            title="Copy Endpoint"
            content={new URL(endpoint).host}
            shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
            onCopy={visit}
          />
        )}
      </>
    );
  },
};

// --- Application Insights --------------------------------------------------------------------

export const appInsights: ResourceTypeDefinition = {
  type: "microsoft.insights/components",
  label: "Application Insights",
  icon: Icon.LineChart,
  Actions: ({ resource, fetchArgs, visit }: ResourceContext) => {
    const connectionString: string | undefined = resource.properties?.ConnectionString;
    return (
      <>
        <Action.Push
          title="Show Logs"
          icon={Icon.Bug}
          target={<AppInsightsLogs app={resource} fetchArgs={fetchArgs} />}
          onPush={visit}
        />
        <Action.OpenInBrowser
          title="Open Live Metrics"
          icon={Icon.Heartbeat}
          url={GetResourceUrl(resource.id, "quickPulse")}
          onOpen={visit}
        />
        {connectionString && (
          <Action.CopyToClipboard
            title="Copy Connection String"
            content={connectionString}
            shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
            onCopy={visit}
          />
        )}
      </>
    );
  },
};

// --- Front Door / CDN endpoints --------------------------------------------------------------

const EndpointActions = ({ resource, fetchArgs, visit }: ResourceContext) => {
  const host: string | undefined = resource.properties?.hostName;
  return (
    <>
      <Action
        title="Purge Cache"
        icon={Icon.Trash}
        onAction={() => {
          visit();
          RunOperation({
            title: `Purging ${resource.name}`,
            successTitle: `Purged ${resource.name}`,
            confirm: {
              title: `Purge all cached content of ${resource.name}?`,
              message: "Purges /* on all domains of the endpoint.",
              action: "Purge",
            },
            run: () => PurgeEndpoint(fetchArgs.credential, resource.id),
          });
        }}
      />
      {host && <Action.OpenInBrowser title="Open Endpoint" url={`https://${host}`} onOpen={visit} />}
      {host && (
        <Action.CopyToClipboard
          title="Copy Endpoint Host"
          content={host}
          shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
          onCopy={visit}
        />
      )}
    </>
  );
};

export const frontDoorEndpoint: ResourceTypeDefinition = {
  type: "microsoft.cdn/profiles/afdendpoints",
  label: "Front Door Endpoint",
  icon: Icon.Network,
  Actions: EndpointActions,
};

export const cdnEndpoint: ResourceTypeDefinition = {
  type: "microsoft.cdn/profiles/endpoints",
  label: "CDN Endpoint",
  icon: Icon.Network,
  Actions: EndpointActions,
};
