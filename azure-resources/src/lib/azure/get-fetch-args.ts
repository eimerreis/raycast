import { FetchArgs } from "./azure";
import { CreateAzureCliCredential } from "./credential";
import { ResolveActiveSubscription } from "./subscription";

export const GetFetchArgs = async (): Promise<FetchArgs> => {
  const subscription = await ResolveActiveSubscription();
  return {
    credential: CreateAzureCliCredential(subscription.id),
    subscriptionId: subscription.id,
    subscriptionName: subscription.name,
  };
};
