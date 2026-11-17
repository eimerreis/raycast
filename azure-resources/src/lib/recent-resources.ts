import { LocalStorage } from "@raycast/api";
import { AzureResource } from "./azure/resource-graph";

const storageKey = "recent-resources";
const maxEntries = 50;
const halfLifeHours = 72;

export type RecentResource = {
  resource: AzureResource;
  subscriptionName: string;
  tenantId: string;
  visits: number;
  lastVisited: number;
};

const Load = async (): Promise<RecentResource[]> => {
  const raw = await LocalStorage.getItem<string>(storageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentResource[];
  } catch {
    return [];
  }
};

const Save = (entries: RecentResource[]) => LocalStorage.setItem(storageKey, JSON.stringify(entries));

/** Frequency weighted by recency: a visit loses half its weight every `halfLifeHours`. */
const Score = (entry: RecentResource, now = Date.now()) =>
  entry.visits * Math.pow(0.5, (now - entry.lastVisited) / (halfLifeHours * 60 * 60 * 1000));

/** Stores a slim copy: `properties` can be large and goes stale; it is refreshed when listing. */
const Slim = (resource: AzureResource): AzureResource => ({ ...resource, properties: null });

export const RecordVisit = async (
  resource: AzureResource,
  subscription: { subscriptionName: string; tenantId: string },
) => {
  const entries = await Load();
  const id = resource.id.toLowerCase();
  const existing = entries.find((entry) => entry.resource.id.toLowerCase() === id);
  const next: RecentResource = {
    resource: Slim(resource),
    subscriptionName: subscription.subscriptionName,
    tenantId: subscription.tenantId,
    visits: (existing?.visits ?? 0) + 1,
    lastVisited: Date.now(),
  };
  const others = entries.filter((entry) => entry.resource.id.toLowerCase() !== id);
  await Save([next, ...others].sort((a, b) => Score(b) - Score(a)).slice(0, maxEntries));
};

export const GetRecentResources = async () => (await Load()).sort((a, b) => Score(b) - Score(a));

export const RemoveRecentResource = async (resourceId: string) =>
  Save((await Load()).filter((entry) => entry.resource.id.toLowerCase() !== resourceId.toLowerCase()));

export const ClearRecentResources = () => LocalStorage.removeItem(storageKey);
