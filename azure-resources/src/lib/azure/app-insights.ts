import type { TokenCredential } from "@azure/identity";
import { AzureRequest } from "./arm";
import { Kql } from "./resource-graph";

const appInsightsApi = "https://api.applicationinsights.io";

export type TimeRange = "PT15M" | "PT1H" | "PT6H" | "PT24H" | "P7D";

export const timeRanges: { value: TimeRange; title: string }[] = [
  { value: "PT15M", title: "Last 15 Minutes" },
  { value: "PT1H", title: "Last Hour" },
  { value: "PT6H", title: "Last 6 Hours" },
  { value: "PT24H", title: "Last 24 Hours" },
  { value: "P7D", title: "Last 7 Days" },
];

export type TelemetryScope = "problems" | "exceptions" | "all";

export const telemetryScopes: { value: TelemetryScope; title: string; section: string; emptyLabel: string }[] = [
  {
    value: "problems",
    title: "Problems",
    section: "Problems (exceptions, failures, warnings)",
    emptyLabel: "problems",
  },
  { value: "exceptions", title: "Exceptions", section: "Exceptions Only", emptyLabel: "exceptions" },
  { value: "all", title: "All", section: "All Telemetry", emptyLabel: "telemetry" },
];

/** Per telemetry table: the summary/message columns and the filter that makes a row a "problem". */
const telemetryTables = [
  {
    table: "exceptions",
    extend: "summary = coalesce(outerMessage, problemId, type), message = coalesce(innermostMessage, outerMessage)",
    problem: "",
  },
  { table: "requests", extend: "summary = strcat(resultCode, ' ', name), message = url", problem: "success == false" },
  { table: "dependencies", extend: "summary = strcat(type, ' ', name), message = data", problem: "success == false" },
  { table: "traces", extend: "summary = message", problem: "severityLevel >= 2" },
  { table: "customEvents", extend: "summary = name, message = ''", problem: undefined },
];

export type TelemetryItem = {
  timestamp: string;
  itemType: "request" | "dependency" | "exception" | "trace" | "customEvent" | string;
  title: string;
  message?: string;
  severityLevel?: number;
  success?: boolean;
  resultCode?: string;
  duration?: number;
  operationId?: string;
  operationName?: string;
  roleName?: string;
  itemId: string;
};

type QueryResponse = {
  tables: { columns: { name: string }[]; rows: unknown[][] }[];
};

const Rows = (response: QueryResponse) => {
  const table = response.tables[0];
  if (!table) return [];
  return table.rows.map((row) =>
    Object.fromEntries(table.columns.map((column, index) => [column.name, row[index]])),
  ) as Record<string, unknown>[];
};

export const QueryAppInsights = async (
  credential: TokenCredential,
  appId: string,
  query: string,
  timespan: TimeRange,
) => {
  const { json } = await AzureRequest<QueryResponse>(credential, `${appInsightsApi}/v1/apps/${appId}/query`, {
    method: "POST",
    body: { query, timespan },
    resource: appInsightsApi,
  });
  return Rows(await json());
};

export type TelemetryFilter = {
  scope: TelemetryScope;
  /** Restricts results to one operation name, e.g. a single Azure Function. */
  operationName?: string;
};

export const GetTelemetry = async (
  credential: TokenCredential,
  appId: string,
  timespan: TimeRange,
  filter: TelemetryFilter,
): Promise<TelemetryItem[]> => {
  const tables = telemetryTables
    .filter(({ table, problem }) =>
      filter.scope === "exceptions" ? table === "exceptions" : filter.scope === "all" || problem !== undefined,
    )
    .map(({ table, extend, problem }) =>
      [`(${table}`, filter.scope === "problems" && problem ? `| where ${problem}` : "", `| extend ${extend})`]
        .filter(Boolean)
        .join(" "),
    );
  const query = [
    `union isfuzzy=true ${tables.join(",\n  ")}`,
    filter.operationName ? `| where operation_Name =~ ${Kql(filter.operationName)}` : "",
    // Columns that only some tables have, so the projection also works for a single table.
    "| extend success = column_ifexists('success', bool(null)), resultCode = column_ifexists('resultCode', ''),",
    "  duration = column_ifexists('duration', real(null)), severityLevel = column_ifexists('severityLevel', int(null))",
    "| order by timestamp desc",
    "| take 300",
    "| project timestamp, itemType, summary, message, severityLevel, success, resultCode, duration, operation_Id, operation_Name, cloud_RoleName, itemId",
  ].join("\n");

  const rows = await QueryAppInsights(credential, appId, query, timespan);
  return rows.map((row) => ({
    timestamp: String(row.timestamp),
    itemType: String(row.itemType),
    title: String(row.summary || row.itemType),
    message: row.message ? String(row.message) : undefined,
    severityLevel: typeof row.severityLevel === "number" ? row.severityLevel : undefined,
    success: typeof row.success === "boolean" ? row.success : row.success === "True" ? true : undefined,
    resultCode: row.resultCode ? String(row.resultCode) : undefined,
    duration: typeof row.duration === "number" ? row.duration : undefined,
    operationId: row.operation_Id ? String(row.operation_Id) : undefined,
    operationName: row.operation_Name ? String(row.operation_Name) : undefined,
    roleName: row.cloud_RoleName ? String(row.cloud_RoleName) : undefined,
    itemId: String(row.itemId),
  }));
};

const IsEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" && Object.keys(value as object).length === 0);

const Compact = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row)
      .map(([key, value]) => [key, typeof value === "string" && /^[[{]/.test(value) ? TryParse(value) : value])
      .filter(([, value]) => !IsEmpty(value)),
  );

const TryParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const maxTraceItems = 1000;

/**
 * Exports every telemetry item of one operation (request, dependencies, traces, exceptions)
 * as compact JSON, ready to hand to an AI agent.
 */
export const ExportOperationTrace = async (
  credential: TokenCredential,
  app: { appId: string; name: string },
  operationId: string,
) => {
  const query = [
    "union isfuzzy=true requests, dependencies, exceptions, traces, customEvents",
    `| where operation_Id == ${Kql(operationId)}`,
    "| order by timestamp asc",
    `| take ${maxTraceItems + 1}`,
    "| project timestamp, itemType, name, message, severityLevel, success, resultCode, duration, url, target, data, type,",
    "  problemId, outerType, outerMessage, innermostType, innermostMessage, details, id, operation_ParentId,",
    "  operation_Name, cloud_RoleName, cloud_RoleInstance, customDimensions",
  ].join("\n");
  const rows = await QueryAppInsights(credential, app.appId, query, "P7D");
  const truncated = rows.length > maxTraceItems;
  const items = rows.slice(0, maxTraceItems);
  return {
    source: "Azure Application Insights",
    application: app.name,
    operationId,
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    // Long-running background operations can share one operation id across many thousands of items.
    ...(truncated ? { truncated: true, note: `Only the first ${maxTraceItems} items are included` } : {}),
    items: items.map(Compact),
  };
};

export const ExportTelemetryList = (app: { name: string }, items: TelemetryItem[], timespan: TimeRange) => ({
  source: "Azure Application Insights",
  application: app.name,
  timespan,
  exportedAt: new Date().toISOString(),
  itemCount: items.length,
  items: items.map((item) => Compact(item as unknown as Record<string, unknown>)),
});
