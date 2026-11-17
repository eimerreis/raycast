import { Action, ActionPanel, Icon } from "@raycast/api";
import { GetResourceUrl, ParseResourceId } from "../../lib/azure/portal";
import { AllowCurrentIpOnSqlServer } from "../../lib/azure/resource-operations";
import { RunOperation } from "../run-operation";
import { KeyVaultSecrets } from "../views/key-vault-secrets";
import { StorageContainers } from "../views/storage-containers";
import { ResourceContext, ResourceTypeDefinition } from "./types";

// --- Storage Account -------------------------------------------------------------------------

export const storageAccount: ResourceTypeDefinition = {
  type: "microsoft.storage/storageaccounts",
  label: "Storage Account",
  icon: Icon.HardDrive,
  Actions: ({ resource, fetchArgs, visit }: ResourceContext) => {
    const blobEndpoint: string | undefined = resource.properties?.primaryEndpoints?.blob;
    return (
      <>
        <Action.Push
          title="Show Containers"
          icon={Icon.Folder}
          target={<StorageContainers account={resource} fetchArgs={fetchArgs} />}
          onPush={visit}
        />
        <Action.OpenInBrowser
          title="Open Storage Browser"
          icon={Icon.Finder}
          url={GetResourceUrl(resource.id, "storagebrowser")}
          onOpen={visit}
        />
        {blobEndpoint && (
          <Action.CopyToClipboard
            title="Copy Blob Endpoint"
            content={blobEndpoint}
            shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
            onCopy={visit}
          />
        )}
      </>
    );
  },
};

// --- Key Vault -------------------------------------------------------------------------------

export const keyVault: ResourceTypeDefinition = {
  type: "microsoft.keyvault/vaults",
  label: "Key Vault",
  icon: Icon.Key,
  Actions: ({ resource, fetchArgs, visit }: ResourceContext) => {
    const vaultUri: string | undefined = resource.properties?.vaultUri;
    return (
      <>
        {vaultUri && (
          <Action.Push
            title="Show Secrets"
            icon={Icon.Key}
            target={<KeyVaultSecrets vault={resource} vaultUri={vaultUri} fetchArgs={fetchArgs} />}
            onPush={visit}
          />
        )}
        {vaultUri && (
          <Action.CopyToClipboard
            title="Copy Vault URI"
            content={vaultUri}
            shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
            onCopy={visit}
          />
        )}
      </>
    );
  },
};

// --- SQL -------------------------------------------------------------------------------------

const AllowMyIpAction = ({
  serverId,
  serverName,
  fetchArgs,
  visit,
}: ResourceContext & { serverId: string; serverName: string }) => (
  <Action
    title="Allow My IP in Firewall"
    icon={Icon.Shield}
    onAction={() => {
      visit();
      RunOperation({
        title: `Adding your IP to ${serverName}`,
        successTitle: ({ ip, ruleName }) => `Allowed ${ip} on ${serverName} (${ruleName})`,
        confirm: {
          title: `Allow your current public IP on ${serverName}?`,
          message: "Creates or updates a firewall rule named after this Mac.",
          action: "Allow",
        },
        run: () => AllowCurrentIpOnSqlServer(fetchArgs.credential, serverId),
      });
    }}
  />
);

export const sqlServer: ResourceTypeDefinition = {
  type: "microsoft.sql/servers",
  label: "SQL Server",
  icon: Icon.HardDrive,
  Actions: (context: ResourceContext) => {
    const fqdn: string | undefined = context.resource.properties?.fullyQualifiedDomainName;
    return (
      <>
        {fqdn && <Action.CopyToClipboard title="Copy Server Name" content={fqdn} onCopy={context.visit} />}
        <AllowMyIpAction {...context} serverId={context.resource.id} serverName={context.resource.name} />
      </>
    );
  },
};

export const sqlDatabase: ResourceTypeDefinition = {
  type: "microsoft.sql/servers/databases",
  label: "SQL Database",
  icon: Icon.HardDrive,
  Actions: (context: ResourceContext) => {
    const { resource, visit } = context;
    const server = ParseResourceId(resource.id).parentName ?? "";
    const database = resource.name.split("/").pop() ?? resource.name;
    const serverId = resource.id.replace(/\/databases\/[^/]+$/i, "");
    const connectionString = `Server=tcp:${server}.database.windows.net,1433;Database=${database};Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;`;
    return (
      <>
        <Action.CopyToClipboard
          title="Copy Connection String"
          content={connectionString}
          shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
          onCopy={visit}
        />
        <Action.CopyToClipboard title="Copy Server Name" content={`${server}.database.windows.net`} onCopy={visit} />
        <ActionPanel.Section title="SQL Server">
          <AllowMyIpAction {...context} serverId={serverId} serverName={server} />
          <Action.OpenInBrowser
            title="Open Query Editor"
            icon={Icon.Code}
            url={GetResourceUrl(resource.id, "queryEditor")}
            onOpen={visit}
          />
        </ActionPanel.Section>
      </>
    );
  },
};

// --- Cosmos DB / Redis -----------------------------------------------------------------------

export const cosmosDb: ResourceTypeDefinition = {
  type: "microsoft.documentdb/databaseaccounts",
  label: "Cosmos DB",
  icon: Icon.Globe,
  Actions: ({ resource, visit }: ResourceContext) => {
    const endpoint: string | undefined = resource.properties?.documentEndpoint;
    return (
      <>
        <Action.OpenInBrowser
          title="Open Data Explorer"
          icon={Icon.MagnifyingGlass}
          url={GetResourceUrl(resource.id, "dataExplorer")}
          onOpen={visit}
        />
        {endpoint && (
          <Action.CopyToClipboard
            title="Copy Endpoint"
            content={endpoint}
            shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
            onCopy={visit}
          />
        )}
      </>
    );
  },
};

export const redisCache: ResourceTypeDefinition = {
  type: "microsoft.cache/redis",
  label: "Redis Cache",
  icon: Icon.MemoryChip,
  Actions: ({ resource, visit }: ResourceContext) => {
    const host: string | undefined = resource.properties?.hostName;
    const port: number | undefined = resource.properties?.sslPort;
    if (!host) return <></>;
    return (
      <Action.CopyToClipboard
        title="Copy Host and Port"
        content={port ? `${host}:${port}` : host}
        shortcut={{ key: "u", modifiers: ["cmd", "shift"] }}
        onCopy={visit}
      />
    );
  },
};
