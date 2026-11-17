import type { TokenCredential } from "@azure/identity";
import { ArmGet } from "./arm";

type LocalizedValue = { value: string; localizedValue: string };

type ActivityLogEvent = {
  eventDataId: string;
  correlationId: string;
  eventTimestamp: string;
  caller?: string;
  level: string;
  resourceId?: string;
  resourceGroupName?: string;
  operationName: LocalizedValue;
  status?: LocalizedValue;
  subStatus?: LocalizedValue;
  properties?: Record<string, string>;
};

export type ActivityLogEntry = {
  id: string;
  correlationId: string;
  timestamp: string;
  operation: string;
  operationId: string;
  status: string;
  caller?: string;
  level: string;
  resourceId?: string;
  resourceGroup?: string;
  message?: string;
};

export type ActivityLogScope = { resourceGroup?: string; resourceId?: string };

const maxPages = 10;

/**
 * Loads the activity log and collapses the Started/Accepted/Succeeded events of one operation
 * into a single entry with its latest status.
 */
export const GetActivityLog = async (
  credential: TokenCredential,
  subscriptionId: string,
  hours: number,
  scope: ActivityLogScope = {},
) => {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const filter = [
    `eventTimestamp ge '${from.toISOString()}'`,
    `eventTimestamp le '${to.toISOString()}'`,
    scope.resourceGroup && `resourceGroupName eq '${scope.resourceGroup}'`,
    scope.resourceId && `resourceUri eq '${scope.resourceId}'`,
  ]
    .filter(Boolean)
    .join(" and ");

  const events: ActivityLogEvent[] = [];
  let next: string | undefined =
    `/subscriptions/${subscriptionId}/providers/Microsoft.Insights/eventtypes/management/values` +
    `?api-version=2015-04-01&$filter=${encodeURIComponent(filter)}`;
  for (let page = 0; next && page < maxPages; page++) {
    const response: { value: ActivityLogEvent[]; nextLink?: string } = await ArmGet(credential, next);
    events.push(...response.value);
    next = response.nextLink;
  }

  const latest = new Map<string, ActivityLogEvent>();
  for (const event of events) {
    const key = `${event.correlationId}|${event.operationName.value}|${event.resourceId}`;
    const existing = latest.get(key);
    if (!existing || existing.eventTimestamp < event.eventTimestamp) {
      latest.set(key, event);
    }
  }

  return [...latest.values()]
    .sort((a, b) => b.eventTimestamp.localeCompare(a.eventTimestamp))
    .map(
      (event): ActivityLogEntry => ({
        id: event.eventDataId,
        correlationId: event.correlationId,
        timestamp: event.eventTimestamp,
        operation: event.operationName.localizedValue || event.operationName.value,
        operationId: event.operationName.value,
        status: event.status?.localizedValue || event.status?.value || "Unknown",
        caller: event.caller,
        level: event.level,
        resourceId: event.resourceId,
        resourceGroup: event.resourceGroupName,
        message: event.properties?.statusMessage,
      }),
    );
};
