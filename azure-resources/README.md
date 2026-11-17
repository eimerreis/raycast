# Azure Resources

- Search resource groups and navigate inside a resource group
- Open a resource in the Azure Portal by name
- Switch the subscription the extension uses

## Requirements

The extension uses the [Azure CLI](https://learn.microsoft.com/cli/azure/) for authentication.
Run `az login` once; set the CLI path in the extension preferences if it is not `/opt/homebrew/bin/az`.

## Subscriptions

"Switch Azure Subscription" only changes the subscription used by this extension.
The Azure CLI default (`az account set`) stays untouched.
Without a selection, the extension uses the Azure CLI default.

## Ideas for the Future

- Add a Detail Page for Resources, which show the most common properties based on the resource type
- Edit Environment Variables of an Azure App Service right from the extension
