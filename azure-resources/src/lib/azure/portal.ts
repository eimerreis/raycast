/** Azure Portal link to a resource, optionally to one of its blades (e.g. `logStream`). */
export const GetResourceUrl = (resourceId: string, blade?: string) =>
  `https://portal.azure.com/#resource${resourceId}${blade ? `/${blade}` : ""}`;

/** Parses `/subscriptions/{sub}/resourceGroups/{rg}/providers/{ns}/{type}/{name}/...` */
export const ParseResourceId = (resourceId: string) => {
  const parts = resourceId.split("/").filter(Boolean);
  const valueOf = (key: string) => {
    const index = parts.findIndex((part) => part.toLowerCase() === key.toLowerCase());
    return index >= 0 ? parts[index + 1] : undefined;
  };
  return {
    subscriptionId: valueOf("subscriptions"),
    resourceGroup: valueOf("resourceGroups"),
    name: parts[parts.length - 1],
    parentName: parts.length >= 10 ? parts[7] : undefined,
  };
};
