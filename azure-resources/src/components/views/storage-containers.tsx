import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { GetResourceUrl } from "../../lib/azure/portal";
import { AzureResource } from "../../lib/azure/resource-graph";
import { ListContainers } from "../../lib/azure/resource-operations";

export const StorageContainers = ({ account, fetchArgs }: { account: AzureResource; fetchArgs: FetchArgs }) => {
  const blobEndpoint: string =
    account.properties?.primaryEndpoints?.blob ?? `https://${account.name}.blob.core.windows.net/`;
  const { data, isLoading } = useCachedPromise(
    (accountId: string) => ListContainers(fetchArgs.credential, accountId),
    [account.id],
  );

  return (
    <List
      navigationTitle={`Containers · ${account.name}`}
      isLoading={isLoading}
      searchBarPlaceholder="Search containers..."
    >
      <List.EmptyView icon={Icon.Folder} title="No blob containers" />
      {data?.map((container) => (
        <List.Item
          key={container.id}
          icon={Icon.Folder}
          title={container.name}
          accessories={[
            ...(container.publicAccess && container.publicAccess !== "None"
              ? [{ tag: { value: `Public: ${container.publicAccess}`, color: Color.Orange } }]
              : []),
            ...(container.lastModified ? [{ date: new Date(container.lastModified), tooltip: "Last modified" }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open Storage Browser" url={GetResourceUrl(account.id, "storagebrowser")} />
              <Action.CopyToClipboard title="Copy Container URL" content={`${blobEndpoint}${container.name}`} />
              <Action.CopyToClipboard title="Copy Container Name" content={container.name} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};
