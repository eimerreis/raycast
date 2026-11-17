# Azure Resources Changelog

## [Reliable subscription switching] - {PR_MERGE_DATE}

- Switching subscriptions now applies the selected subscription and reports failures
- The selected subscription is stored per extension and no longer changes the Azure CLI default
- Cached lists are scoped per subscription and resource group
- Access tokens are no longer copied to the clipboard or written to the cache
- Clear error view when the Azure CLI is missing or not logged in

## [Initial Version] - {PR_MERGE_DATE}
