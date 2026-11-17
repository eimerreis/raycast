import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { FetchArgs } from "../../lib/azure/get-fetch-args";
import { AzureResource } from "../../lib/azure/resource-graph";
import { ListRevisions, RestartRevision } from "../../lib/azure/resource-operations";
import { RunOperation } from "../run-operation";

const HealthColor = (state?: string) =>
  state === "Healthy" ? Color.Green : state === "Unhealthy" ? Color.Red : Color.SecondaryText;

export const ContainerAppRevisions = ({ app, fetchArgs }: { app: AzureResource; fetchArgs: FetchArgs }) => {
  const { data, isLoading, revalidate } = useCachedPromise(
    (appId: string) => ListRevisions(fetchArgs.credential, appId),
    [app.id],
  );

  return (
    <List navigationTitle={`Revisions · ${app.name}`} isLoading={isLoading}>
      {data?.map((revision) => (
        <List.Item
          key={revision.id}
          icon={revision.active ? { source: Icon.CircleFilled, tintColor: Color.Green } : Icon.Circle}
          title={revision.name}
          subtitle={revision.trafficWeight ? `${revision.trafficWeight}% traffic` : undefined}
          accessories={[
            ...(revision.healthState
              ? [{ tag: { value: revision.healthState, color: HealthColor(revision.healthState) } }]
              : []),
            ...(revision.replicas !== undefined ? [{ text: `${revision.replicas} replicas` }] : []),
            ...(revision.createdTime ? [{ date: new Date(revision.createdTime) }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Restart Revision"
                icon={Icon.ArrowClockwise}
                onAction={() =>
                  RunOperation({
                    title: `Restarting ${revision.name}`,
                    successTitle: `Restarted ${revision.name}`,
                    confirm: { title: `Restart ${revision.name}?`, action: "Restart" },
                    run: () => RestartRevision(fetchArgs.credential, revision.id),
                    onDone: revalidate,
                  })
                }
              />
              <Action.CopyToClipboard title="Copy Revision Name" content={revision.name} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
};
