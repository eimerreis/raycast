import { Action, ActionPanel, Color, Icon } from "@raycast/api";
import { GetResourceUrl } from "../../lib/azure/portal";
import { AzureResource } from "../../lib/azure/resource-graph";
import { RestartRevision } from "../../lib/azure/resource-operations";
import { RunOperation } from "../run-operation";
import { ContainerAppRevisions } from "../views/container-app-revisions";
import { ResourceContext, ResourceStatus, ResourceTypeDefinition } from "./types";

const AppUrl = (resource: AzureResource) => {
  const fqdn: string | undefined =
    resource.properties?.configuration?.ingress?.fqdn ?? resource.properties?.latestRevisionFqdn;
  return fqdn ? `https://${fqdn}` : undefined;
};

const Status = (resource: AzureResource): ResourceStatus | undefined => {
  const state: string | undefined = resource.properties?.runningStatus;
  if (!state) return undefined;
  return { value: state, color: state === "Running" ? Color.Green : Color.SecondaryText };
};

const ContainerAppActions = ({ resource, fetchArgs, visit, refresh }: ResourceContext) => {
  const url = AppUrl(resource);
  const latestRevision: string | undefined = resource.properties?.latestRevisionName;

  return (
    <>
      {url && <Action.OpenInBrowser title="Open App" url={url} onOpen={visit} />}
      <Action.Push
        title="Show Revisions"
        icon={Icon.Layers}
        shortcut={{ key: "v", modifiers: ["cmd", "shift"] }}
        target={<ContainerAppRevisions app={resource} fetchArgs={fetchArgs} />}
        onPush={visit}
      />
      {url && (
        <Action.CopyToClipboard
          title="Copy URL"
          content={url}
          shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
          onCopy={visit}
        />
      )}
      <ActionPanel.Section title="Container App">
        {latestRevision && (
          <Action
            title="Restart Latest Revision"
            icon={Icon.ArrowClockwise}
            shortcut={{ key: "r", modifiers: ["cmd", "opt"] }}
            onAction={() => {
              visit();
              RunOperation({
                title: `Restarting ${latestRevision}`,
                successTitle: `Restarted ${latestRevision}`,
                confirm: { title: `Restart ${latestRevision}?`, action: "Restart" },
                run: () => RestartRevision(fetchArgs.credential, `${resource.id}/revisions/${latestRevision}`),
                onDone: refresh,
              });
            }}
          />
        )}
        <Action.OpenInBrowser
          title="Open Log Stream"
          icon={Icon.Text}
          url={GetResourceUrl(resource.id, "logstream")}
          onOpen={visit}
        />
      </ActionPanel.Section>
    </>
  );
};

export const containerApp: ResourceTypeDefinition = {
  type: "microsoft.app/containerapps",
  label: "Container App",
  icon: Icon.Box,
  status: Status,
  Actions: ContainerAppActions,
};
