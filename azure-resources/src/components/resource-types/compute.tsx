import { Action, ActionPanel, Clipboard, Color, Icon, showHUD } from "@raycast/api";
import { AzureResource } from "../../lib/azure/resource-graph";
import {
  DeallocateVm,
  GetVmAddresses,
  RestartVm,
  StartAks,
  StartVm,
  StopAks,
} from "../../lib/azure/resource-operations";
import { RunOperation, WithFailureToast } from "../run-operation";
import { ResourceContext, ResourceStatus, ResourceTypeDefinition } from "./types";

// --- Virtual Machine -------------------------------------------------------------------------

/** `PowerState/running` → `running` */
const VmPowerState = (resource: AzureResource): string | undefined =>
  resource.properties?.extended?.instanceView?.powerState?.code?.split("/")[1];

const VmStatus = (resource: AzureResource): ResourceStatus | undefined => {
  const state = VmPowerState(resource);
  if (!state) return undefined;
  const color =
    state === "running"
      ? Color.Green
      : state === "starting" || state === "stopping"
        ? Color.Orange
        : Color.SecondaryText;
  return { value: state, color };
};

const CopyAddress = async (context: ResourceContext, pick: "public" | "private" | "ssh") => {
  context.visit();
  const addresses = await WithFailureToast("Could not load IP addresses", () =>
    GetVmAddresses(context.fetchArgs.credential, context.resource),
  );
  if (!addresses) return;
  const ip = pick === "private" ? addresses.privateIps[0] : addresses.publicIps[0];
  if (!ip) {
    await showHUD(`No ${pick === "private" ? "private" : "public"} IP address`);
    return;
  }
  const user: string | undefined = context.resource.properties?.osProfile?.adminUsername;
  const content = pick === "ssh" ? `ssh ${user ? `${user}@` : ""}${ip}` : ip;
  await Clipboard.copy(content);
  await showHUD(`Copied ${content}`);
};

const VmActions = (context: ResourceContext) => {
  const { resource, fetchArgs, visit, refresh } = context;
  const state = VmPowerState(resource);
  const isRunning = state === "running" || state === "starting";

  const start = (
    <Action
      title="Start VM"
      icon={Icon.Play}
      onAction={() => {
        visit();
        RunOperation({
          title: `Starting ${resource.name}`,
          successTitle: `Started ${resource.name}`,
          run: () => StartVm(fetchArgs.credential, resource.id),
          onDone: refresh,
        });
      }}
    />
  );
  const stop = (
    <Action
      title="Stop VM (Deallocate)"
      icon={Icon.Stop}
      style={Action.Style.Destructive}
      onAction={() => {
        visit();
        RunOperation({
          title: `Stopping ${resource.name}`,
          successTitle: `Stopped ${resource.name}`,
          confirm: {
            title: `Stop ${resource.name}?`,
            message: "The VM is deallocated and its dynamic public IP may change.",
            action: "Stop",
          },
          run: () => DeallocateVm(fetchArgs.credential, resource.id),
          onDone: refresh,
        });
      }}
    />
  );

  return (
    <>
      {isRunning ? stop : start}
      <Action
        title="Copy SSH Command"
        icon={Icon.Terminal}
        shortcut={{ key: "s", modifiers: ["cmd", "opt"] }}
        onAction={() => CopyAddress(context, "ssh")}
      />
      <ActionPanel.Section title="Virtual Machine">
        <Action
          title="Restart VM"
          icon={Icon.ArrowClockwise}
          shortcut={{ key: "r", modifiers: ["cmd", "opt"] }}
          onAction={() => {
            visit();
            RunOperation({
              title: `Restarting ${resource.name}`,
              successTitle: `Restarted ${resource.name}`,
              confirm: { title: `Restart ${resource.name}?`, action: "Restart" },
              run: () => RestartVm(fetchArgs.credential, resource.id),
              onDone: refresh,
            });
          }}
        />
        <Action title="Copy Public IP" icon={Icon.Network} onAction={() => CopyAddress(context, "public")} />
        <Action title="Copy Private IP" icon={Icon.Network} onAction={() => CopyAddress(context, "private")} />
      </ActionPanel.Section>
    </>
  );
};

export const virtualMachine: ResourceTypeDefinition = {
  type: "microsoft.compute/virtualmachines",
  label: "Virtual Machine",
  icon: Icon.Desktop,
  status: VmStatus,
  Actions: VmActions,
};

// --- AKS -------------------------------------------------------------------------------------

const AksStatus = (resource: AzureResource): ResourceStatus | undefined => {
  const state: string | undefined = resource.properties?.powerState?.code;
  if (!state) return undefined;
  return { value: state, color: state === "Running" ? Color.Green : Color.SecondaryText };
};

const AksActions = ({ resource, fetchArgs, visit, refresh }: ResourceContext) => {
  const isRunning = resource.properties?.powerState?.code === "Running";
  const command = `az aks get-credentials --resource-group ${resource.resourceGroup} --name ${resource.name} --subscription ${resource.subscriptionId}`;

  return (
    <>
      <Action.CopyToClipboard title="Copy Get-Credentials Command" content={command} onCopy={visit} />
      <ActionPanel.Section title="Kubernetes Service">
        {isRunning ? (
          <Action
            title="Stop Cluster"
            icon={Icon.Stop}
            style={Action.Style.Destructive}
            onAction={() => {
              visit();
              RunOperation({
                title: `Stopping ${resource.name}`,
                successTitle: `Stopped ${resource.name}`,
                confirm: { title: `Stop cluster ${resource.name}?`, message: "All workloads stop.", action: "Stop" },
                run: () => StopAks(fetchArgs.credential, resource.id),
                onDone: refresh,
              });
            }}
          />
        ) : (
          <Action
            title="Start Cluster"
            icon={Icon.Play}
            onAction={() => {
              visit();
              RunOperation({
                title: `Starting ${resource.name}`,
                successTitle: `Started ${resource.name}`,
                run: () => StartAks(fetchArgs.credential, resource.id),
                onDone: refresh,
              });
            }}
          />
        )}
      </ActionPanel.Section>
    </>
  );
};

export const kubernetesCluster: ResourceTypeDefinition = {
  type: "microsoft.containerservice/managedclusters",
  label: "Kubernetes Service",
  icon: Icon.Boat,
  status: AksStatus,
  Actions: AksActions,
};
