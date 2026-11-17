# Azure Resources

Search, inspect and operate Azure resources from Raycast.

## Commands

| Command | What it does |
| --- | --- |
| Search Resources | Search resources by name in the active subscription or the whole tenant, filter by type |
| Search Resource Groups | Browse resource groups and their resources, grouped by type |
| Recent Resources | Resources you used most often and most recently, across subscriptions |
| App Insights Logs | Exceptions, failed requests and dependencies, warnings and traces; export as JSON |
| Service Bus Dead Letters | Dead-letter counts of all queues and topic subscriptions; peek messages |
| Activity Log | Who changed what in the subscription, a resource group or a single resource |
| Open Azure Resource | Open a resource in the portal by its exact name |
| Switch Azure Subscription | Change the subscription the extension uses (also available as ⌘⇧S in lists) |

## Actions per resource type

The first action is the primary one (↵).

| Type | Actions |
| --- | --- |
| App Service | Open site, App Insights logs, copy URL, restart, start/stop, deployment slots and swap, Kudu, log stream |
| Function App | Open site, functions with per-function logs, App Insights logs, restart, start/stop, slots, Kudu |
| Static Web App | Open site, copy URL |
| Virtual Machine | Start or stop (deallocate) depending on state, copy SSH command, restart, copy public/private IP |
| Container App | Open app, revisions (restart), copy URL, restart latest revision, log stream |
| Kubernetes Service | Copy `az aks get-credentials`, start/stop cluster |
| Storage Account | Containers, storage browser, copy blob endpoint |
| Key Vault | Secret names; copy a value on demand (concealed clipboard), copy Key Vault reference |
| SQL Server / Database | Copy connection string (Entra auth, no password) and server name, allow my IP in firewall, query editor |
| Cosmos DB / Redis | Data Explorer, copy endpoint / host and port |
| Service Bus | Queues and subscriptions with dead-letter counts |
| Application Insights | Logs, live metrics, copy connection string |
| Front Door / CDN Endpoint | Purge cache, open endpoint, copy host |

Every resource also has: open in portal, details (status, tags, properties), activity log, copy ID and name.
Actions that interrupt a service (restart, stop, swap, purge) ask for confirmation.

## App Insights export for AI agents

In App Insights Logs, ↵ copies the full operation trace (request, dependencies, traces, exceptions) as compact JSON.
⌘⇧J copies all listed items.
Empty fields are dropped; traces are capped at 1000 items.

## Requirements

The extension authenticates with the [Azure CLI](https://learn.microsoft.com/cli/azure/).
Run `az login` once; set the CLI path in the extension preferences if it is not `/opt/homebrew/bin/az`.

Some features need data-plane roles in addition to Reader:

- Key Vault secrets: "Key Vault Secrets User" (or an access policy with list/get)
- Service Bus peek: "Azure Service Bus Data Receiver"
- Finding the App Insights of a web app reads its app settings: "Website Contributor"

## Subscriptions

Switching the subscription only affects this extension; the Azure CLI default (`az account set`) stays untouched.
Without a selection, the extension uses the Azure CLI default.

## Privacy

Access tokens stay in memory.
Key Vault secret names, telemetry and Service Bus messages are not cached on disk.
Recent resources store IDs, names and types locally.
