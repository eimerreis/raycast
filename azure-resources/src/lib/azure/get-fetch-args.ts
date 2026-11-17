import type { TokenCredential } from "@azure/identity";
import { CreateAzureCliCredential } from "./credential";
import { ResolveActiveSubscription } from "./subscription";

export type FetchArgs = {
  credential: TokenCredential;
  subscriptionId: string;
  subscriptionName: string;
  tenantId: string;
};

export const CreateFetchArgs = (subscription: { id: string; name: string; tenantId: string }): FetchArgs => ({
  credential: CreateAzureCliCredential(subscription.id),
  subscriptionId: subscription.id,
  subscriptionName: subscription.name,
  tenantId: subscription.tenantId,
});

export const GetFetchArgs = async (): Promise<FetchArgs> => CreateFetchArgs(await ResolveActiveSubscription());
