import { LaunchProps, open, showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { GetFetchArgs } from "./lib/azure/get-fetch-args";
import { GetResourceUrl } from "./lib/azure/portal";
import { GetResourceByName } from "./lib/azure/resource-graph";
import { RecordVisit } from "./lib/recent-resources";

type Props = LaunchProps<{ arguments: Arguments.OpenAzureResource }>;

export default async function OpenAzureResource({ arguments: { resourceName } }: Props) {
  const name = resourceName.trim();
  const toast = await showToast({ title: `Searching for ${name}...`, style: Toast.Style.Animated });

  try {
    const fetchArgs = await GetFetchArgs();
    const resource = await GetResourceByName(fetchArgs.credential, [fetchArgs.subscriptionId], name);

    if (!resource) {
      toast.style = Toast.Style.Failure;
      toast.title = `Resource ${name} not found`;
      toast.message = `Subscription: ${fetchArgs.subscriptionName}`;
      return;
    }

    await RecordVisit(resource, fetchArgs);
    await toast.hide();
    await open(GetResourceUrl(resource.id));
  } catch (error) {
    await showFailureToast(error, { title: `Could not open ${name}` });
  }
}
