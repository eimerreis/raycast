import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { GetResourceUrl } from "../../lib/azure/portal";
import { AzureResource } from "../../lib/azure/resource-graph";
import { ListSlots, SwapSlotIntoProduction } from "../../lib/azure/resource-operations";
import { RunOperation } from "../run-operation";

export const AppServiceSlots = ({ site, fetchArgs }: { site: AzureResource; fetchArgs: FetchArgs }) => {
  const { data, isLoading, revalidate } = useCachedPromise(
    (siteId: string) => ListSlots(fetchArgs.credential, siteId),
    [site.id],
  );

  return (
    <List navigationTitle={`Slots · ${site.name}`} isLoading={isLoading}>
      <List.EmptyView icon={Icon.Layers} title="No deployment slots" description="Only the production slot exists." />
      {data?.map((slot) => (
        <List.Item
          key={slot.id}
          icon={Icon.Layers}
          title={slot.name}
          subtitle={slot.defaultHostName}
          accessories={
            slot.state
              ? [{ tag: { value: slot.state, color: slot.state === "Running" ? Color.Green : Color.Red } }]
              : []
          }
          actions={
            <ActionPanel>
              {slot.defaultHostName && (
                <Action.OpenInBrowser title="Open Slot" url={`https://${slot.defaultHostName}`} />
              )}
              <Action
                title="Swap into Production"
                icon={Icon.Switch}
                style={Action.Style.Destructive}
                onAction={() =>
                  RunOperation({
                    title: `Swapping ${slot.name} into production`,
                    successTitle: `Swapped ${slot.name} into production`,
                    confirm: {
                      title: `Swap ${slot.name} into production?`,
                      message: `${site.name} production is replaced by the ${slot.name} slot.`,
                      action: "Swap",
                    },
                    run: () => SwapSlotIntoProduction(fetchArgs.credential, slot.id),
                    onDone: revalidate,
                  })
                }
              />
              <Action.OpenInBrowser title="Open in Portal" url={GetResourceUrl(slot.id)} />
              {slot.defaultHostName && (
                <Action.CopyToClipboard title="Copy URL" content={`https://${slot.defaultHostName}`} />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};
