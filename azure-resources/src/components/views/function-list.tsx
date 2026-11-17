import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { AzureResource } from "../../lib/azure/resource-graph";
import { ListFunctions } from "../../lib/azure/resource-operations";
import { RecordVisit } from "../../lib/recent-resources";
import { OpenLinkedLogsAction } from "../resource-types/web";

const FunctionPortalUrl = (functionId: string) =>
  `https://portal.azure.com/#view/WebsitesExtension/FunctionMenuBlade/~/functionOverview/resourceId/${encodeURIComponent(functionId)}`;

export const FunctionList = ({ site, fetchArgs }: { site: AzureResource; fetchArgs: FetchArgs }) => {
  const { data, isLoading } = useCachedPromise(
    (siteId: string) => ListFunctions(fetchArgs.credential, siteId),
    [site.id],
  );
  const context = { resource: site, fetchArgs, visit: () => RecordVisit(site, fetchArgs), refresh: () => {} };

  return (
    <List navigationTitle={`Functions · ${site.name}`} isLoading={isLoading} searchBarPlaceholder="Search functions...">
      <List.EmptyView icon={Icon.Bolt} title="No functions found" />
      {data?.map((fn) => (
        <List.Item
          key={fn.id}
          icon={Icon.Bolt}
          title={fn.name}
          accessories={fn.isDisabled ? [{ tag: { value: "Disabled", color: Color.SecondaryText } }] : []}
          actions={
            <ActionPanel>
              <OpenLinkedLogsAction context={context} operationName={fn.name} title="Show Logs" />
              <Action.OpenInBrowser title="Open in Portal" url={FunctionPortalUrl(fn.id)} />
              {fn.invokeUrl && (
                <Action.CopyToClipboard
                  title="Copy Invoke URL"
                  content={fn.invokeUrl}
                  shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
                />
              )}
              <Action.CopyToClipboard title="Copy Function Name" content={fn.name} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};
