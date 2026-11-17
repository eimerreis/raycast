import { Action, ActionPanel, Color, Icon, useNavigation } from "@raycast/api";
import { GetResourceUrl } from "../../lib/azure/portal";
import { FindLinkedAppInsights, RestartWebApp, StartWebApp, StopWebApp } from "../../lib/azure/resource-operations";
import { RunOperation, WithFailureToast } from "../run-operation";
import { ResourceContext, ResourceStatus, ResourceTypeDefinition } from "./types";
import { AzureResource } from "../../lib/azure/resource-graph";
import { AppServiceSlots } from "../views/app-service-slots";
import { FunctionList } from "../views/function-list";
import { AppInsightsLogs } from "../views/app-insights-logs";

const SiteUrl = (resource: AzureResource) =>
  resource.properties?.defaultHostName ? `https://${resource.properties.defaultHostName}` : undefined;

const ScmUrl = (resource: AzureResource) => {
  const hostNames: { name: string; hostType: string }[] = resource.properties?.hostNameSslStates ?? [];
  const scm = hostNames.find((host) => host.hostType === "Repository")?.name;
  return scm ? `https://${scm}` : undefined;
};

const SiteStatus = (resource: AzureResource): ResourceStatus | undefined => {
  const state: string | undefined = resource.properties?.state;
  if (!state) return undefined;
  return { value: state, color: state === "Running" ? Color.Green : Color.Red };
};

/** Opens the App Insights logs of the component the app reports to. */
export const OpenLinkedLogsAction = ({
  context,
  operationName,
  title = "Show App Insights Logs",
}: {
  context: ResourceContext;
  operationName?: string;
  title?: string;
}) => {
  const { push } = useNavigation();
  return (
    <Action
      title={title}
      icon={Icon.Bug}
      shortcut={{ key: "l", modifiers: ["cmd", "shift"] }}
      onAction={async () => {
        context.visit();
        const component = await WithFailureToast("Could not find linked App Insights", async () => {
          const linked = await FindLinkedAppInsights(context.fetchArgs.credential, context.resource);
          if (!linked) throw new Error("No Application Insights connection string in the app settings");
          return linked;
        });
        if (component) {
          push(<AppInsightsLogs app={component} fetchArgs={context.fetchArgs} operationName={operationName} />);
        }
      }}
    />
  );
};

const SiteActions = (context: ResourceContext & { isFunctionApp: boolean }) => {
  const { resource, fetchArgs, visit, refresh } = context;
  const url = SiteUrl(resource);
  const scm = ScmUrl(resource);
  const isRunning = resource.properties?.state === "Running";

  return (
    <>
      {url && <Action.OpenInBrowser title="Open Site" url={url} onOpen={visit} />}
      {context.isFunctionApp && (
        <Action.Push
          title="Show Functions"
          icon={Icon.List}
          shortcut={{ key: "f", modifiers: ["cmd", "shift"] }}
          target={<FunctionList site={resource} fetchArgs={fetchArgs} />}
          onPush={visit}
        />
      )}
      <OpenLinkedLogsAction context={context} />
      {url && (
        <Action.CopyToClipboard
          title="Copy URL"
          content={url}
          shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
          onCopy={visit}
        />
      )}
      <ActionPanel.Section title={context.isFunctionApp ? "Function App" : "App Service"}>
        <Action
          title="Restart"
          icon={Icon.ArrowClockwise}
          shortcut={{ key: "r", modifiers: ["cmd", "opt"] }}
          onAction={() => {
            visit();
            RunOperation({
              title: `Restarting ${resource.name}`,
              successTitle: `Restarted ${resource.name}`,
              confirm: {
                title: `Restart ${resource.name}?`,
                message: "The app is briefly unavailable.",
                action: "Restart",
              },
              run: () => RestartWebApp(fetchArgs.credential, resource.id),
              onDone: refresh,
            });
          }}
        />
        {isRunning ? (
          <Action
            title="Stop"
            icon={Icon.Stop}
            style={Action.Style.Destructive}
            onAction={() => {
              visit();
              RunOperation({
                title: `Stopping ${resource.name}`,
                successTitle: `Stopped ${resource.name}`,
                confirm: { title: `Stop ${resource.name}?`, action: "Stop" },
                run: () => StopWebApp(fetchArgs.credential, resource.id),
                onDone: refresh,
              });
            }}
          />
        ) : (
          <Action
            title="Start"
            icon={Icon.Play}
            onAction={() => {
              visit();
              RunOperation({
                title: `Starting ${resource.name}`,
                successTitle: `Started ${resource.name}`,
                run: () => StartWebApp(fetchArgs.credential, resource.id),
                onDone: refresh,
              });
            }}
          />
        )}
        <Action.Push
          title="Deployment Slots"
          icon={Icon.Layers}
          target={<AppServiceSlots site={resource} fetchArgs={fetchArgs} />}
          onPush={visit}
        />
        {scm && <Action.OpenInBrowser title="Open Kudu" icon={Icon.Terminal} url={scm} onOpen={visit} />}
        <Action.OpenInBrowser
          title="Open Log Stream"
          icon={Icon.Text}
          url={GetResourceUrl(resource.id, "logStream")}
          onOpen={visit}
        />
      </ActionPanel.Section>
    </>
  );
};

const IsFunctionApp = (kind: string) => kind.toLowerCase().includes("functionapp");

export const functionApp: ResourceTypeDefinition = {
  type: "microsoft.web/sites",
  matchesKind: IsFunctionApp,
  label: "Function App",
  icon: Icon.Bolt,
  status: SiteStatus,
  Actions: (context) => <SiteActions {...context} isFunctionApp />,
};

export const appService: ResourceTypeDefinition = {
  type: "microsoft.web/sites",
  label: "App Service",
  icon: Icon.Globe,
  status: SiteStatus,
  Actions: (context) => <SiteActions {...context} isFunctionApp={false} />,
};

export const staticWebApp: ResourceTypeDefinition = {
  type: "microsoft.web/staticsites",
  label: "Static Web App",
  icon: Icon.Document,
  Actions: ({ resource, visit }) => {
    const host: string | undefined = resource.properties?.defaultHostname;
    if (!host) return <></>;
    return (
      <>
        <Action.OpenInBrowser title="Open Site" url={`https://${host}`} onOpen={visit} />
        <Action.CopyToClipboard
          title="Copy URL"
          content={`https://${host}`}
          shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
          onCopy={visit}
        />
      </>
    );
  },
};
