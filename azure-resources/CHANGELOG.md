# Azure Resources Changelog

## [Resource Actions, Logs and Dead Letters] - {PR_MERGE_DATE}

- New commands: Search Resources, Recent Resources, App Insights Logs, Service Bus Dead Letters, Activity Log
- Actions per resource type (App Service, Function App, VM, Container App, AKS, Storage, Key Vault, SQL, Cosmos DB, Redis, Service Bus, App Insights, Front Door/CDN)
- Copy App Insights operation traces as JSON for AI agents
- Resource lists use Azure Resource Graph and show status tags

## [Reliable subscription switching] - {PR_MERGE_DATE}

- Switching subscriptions now applies the selected subscription and reports failures
- The selected subscription is stored per extension and no longer changes the Azure CLI default
- Cached lists are scoped per subscription and resource group
- Access tokens are no longer copied to the clipboard or written to the cache
- Clear error view when the Azure CLI is missing or not logged in

## [Initial Version] - {PR_MERGE_DATE}
