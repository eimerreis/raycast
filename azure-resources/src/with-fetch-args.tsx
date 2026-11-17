import { Action, ActionPanel, Icon, LaunchType, List, launchCommand } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { FetchArgs } from "./lib/azure/azure";
import { GetFetchArgs } from "./lib/azure/get-fetch-args";

export type PropsWithFetchArgs = { fetchArgs: FetchArgs };

/**
 * Resolves the active subscription and an Azure CLI backed credential before rendering the command.
 * Pushed child views should receive `fetchArgs` as a prop instead of being wrapped again.
 */
export const withFetchArgs =
  <P extends PropsWithFetchArgs>(Component: React.ComponentType<P>): React.ComponentType<Omit<P, "fetchArgs">> =>
  (props: Omit<P, "fetchArgs">) => {
    const { data: fetchArgs, error, isLoading, revalidate } = usePromise(GetFetchArgs, [], { onError: () => {} });

    if (error) {
      return (
        <List>
          <List.EmptyView
            icon={Icon.Warning}
            title="Could not connect to Azure"
            description={error.message}
            actions={
              <ActionPanel>
                <Action title="Retry" icon={Icon.ArrowClockwise} onAction={revalidate} />
                <Action
                  title="Switch Azure Subscription"
                  icon={Icon.Switch}
                  onAction={() => launchCommand({ name: "switch-azure-subscription", type: LaunchType.UserInitiated })}
                />
              </ActionPanel>
            }
          />
        </List>
      );
    }

    if (isLoading || !fetchArgs) {
      return <List isLoading searchBarPlaceholder="Loading..." />;
    }

    return <Component {...({ ...props, fetchArgs } as P)} />;
  };
