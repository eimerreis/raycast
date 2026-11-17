import { Action, ActionPanel, Clipboard, Color, Icon, List, showHUD } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { GetSecretValue, ListSecrets, SecretInfo } from "../../lib/azure/key-vault";
import { GetResourceUrl } from "../../lib/azure/portal";
import { AzureResource } from "../../lib/azure/resource-graph";
import { WithFailureToast } from "../run-operation";

type Props = { vault: AzureResource; vaultUri: string; fetchArgs: FetchArgs };

/**
 * Lists secret names only. A value is fetched when explicitly copied and put on the clipboard
 * as concealed, so clipboard managers (including Raycast's history) skip it.
 */
export const KeyVaultSecrets = ({ vault, vaultUri, fetchArgs }: Props) => {
  // Not cached: secret names of a vault should not end up on disk.
  const { data, isLoading, error } = usePromise(ListSecrets, [fetchArgs.credential, vaultUri]);

  const copyValue = async (secret: SecretInfo) => {
    const value = await WithFailureToast(`Could not read ${secret.name}`, () =>
      GetSecretValue(fetchArgs.credential, vaultUri, secret.name),
    );
    if (value === undefined) return;
    await Clipboard.copy(value, { concealed: true });
    await showHUD(`Copied value of ${secret.name}`);
  };

  return (
    <List navigationTitle={`Secrets · ${vault.name}`} isLoading={isLoading} searchBarPlaceholder="Search secrets...">
      {error ? (
        <List.EmptyView icon={Icon.Lock} title="Could not list secrets" description={error.message} />
      ) : (
        <List.EmptyView icon={Icon.Key} title="No secrets" />
      )}
      {data?.map((secret) => (
        <List.Item
          key={secret.id}
          icon={Icon.Key}
          title={secret.name}
          subtitle={secret.contentType}
          accessories={[
            ...(!secret.enabled ? [{ tag: { value: "Disabled", color: Color.SecondaryText } }] : []),
            ...(secret.updated ? [{ date: secret.updated, tooltip: "Last updated" }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action title="Copy Secret Value" icon={Icon.Clipboard} onAction={() => copyValue(secret)} />
              <Action.CopyToClipboard title="Copy Secret Name" content={secret.name} />
              <Action.CopyToClipboard
                title="Copy Key Vault Reference"
                content={`@Microsoft.KeyVault(SecretUri=${vaultUri.replace(/\/+$/, "")}/secrets/${secret.name})`}
              />
              <Action.OpenInBrowser title="Open Vault in Portal" url={GetResourceUrl(vault.id, "secrets")} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};
