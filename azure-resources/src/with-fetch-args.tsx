import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { FetchArgs } from "./lib/azure/azure";
import { GetFetchArgs } from "./lib/azure/get-fetch-args";
import { SwitchSubscriptionAction } from "./subscription-list";

export type PropsWithFetchArgs = {
  fetchArgs: FetchArgs;
  /** Resolves the active subscription again, e.g. after switching it. */
  reloadFetchArgs: () => void;
};

/**
 * Resolves the active subscription and an Azure CLI backed credential before rendering the command.
 * Pushed child views should receive `fetchArgs` as a prop instead of being wrapped again.
 */
export const withFetchArgs =
  <P extends PropsWithFetchArgs>(
    Component: React.ComponentType<P>,
  ): React.ComponentType<Omit<P, keyof PropsWithFetchArgs>> =>
  (props: Omit<P, keyof PropsWithFetchArgs>) => {
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
                <SwitchSubscriptionAction onSwitched={revalidate} />
              </ActionPanel>
            }
          />
        </List>
      );
    }

    if (isLoading || !fetchArgs) {
      return <List isLoading searchBarPlaceholder="Loading..." />;
    }

    const reloadFetchArgs = () => {
      revalidate();
    };
    return <Component {...({ ...props, fetchArgs, reloadFetchArgs } as P)} />;
  };
