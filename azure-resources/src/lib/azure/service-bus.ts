import type { TokenCredential } from "@azure/identity";
import { ServiceBusClient, ServiceBusReceivedMessage } from "@azure/service-bus";
import { ArmList } from "./arm";
import { AzureResource } from "./resource-graph";

const apiVersion = "2021-11-01";

type CountDetails = {
  activeMessageCount?: number;
  deadLetterMessageCount?: number;
  scheduledMessageCount?: number;
  transferDeadLetterMessageCount?: number;
};

type ArmEntity = { id: string; name: string; properties: { countDetails?: CountDetails; status?: string } };

export type ServiceBusEntity = {
  id: string;
  namespace: string;
  namespaceId: string;
  kind: "queue" | "subscription";
  /** Queue name, or topic name for subscriptions. */
  entityName: string;
  subscriptionName?: string;
  path: string;
  activeCount: number;
  deadLetterCount: number;
  status?: string;
};

const ToEntity = (
  namespace: AzureResource,
  entity: ArmEntity,
  kind: ServiceBusEntity["kind"],
  topic?: string,
): ServiceBusEntity => ({
  id: entity.id,
  namespace: namespace.name,
  namespaceId: namespace.id,
  kind,
  entityName: topic ?? entity.name,
  subscriptionName: topic ? entity.name : undefined,
  path: topic ? `${topic}/subscriptions/${entity.name}` : entity.name,
  activeCount: entity.properties.countDetails?.activeMessageCount ?? 0,
  deadLetterCount:
    (entity.properties.countDetails?.deadLetterMessageCount ?? 0) +
    (entity.properties.countDetails?.transferDeadLetterMessageCount ?? 0),
  status: entity.properties.status,
});

export const GetServiceBusEntities = async (credential: TokenCredential, namespace: AzureResource) => {
  const [queues, topics] = await Promise.all([
    ArmList<ArmEntity>(credential, `${namespace.id}/queues?api-version=${apiVersion}`),
    ArmList<ArmEntity>(credential, `${namespace.id}/topics?api-version=${apiVersion}`),
  ]);
  const subscriptions = await Promise.all(
    topics.map(async (topic) =>
      (await ArmList<ArmEntity>(credential, `${topic.id}/subscriptions?api-version=${apiVersion}`)).map((sub) =>
        ToEntity(namespace, sub, "subscription", topic.name),
      ),
    ),
  );
  return [...queues.map((queue) => ToEntity(namespace, queue, "queue")), ...subscriptions.flat()];
};

export type DeadLetterMessage = {
  sequenceNumber: string;
  messageId?: string;
  enqueuedTime?: string;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
  deliveryCount?: number;
  subject?: string;
  correlationId?: string;
  contentType?: string;
  applicationProperties?: Record<string, unknown>;
  body: unknown;
};

const DecodeBody = (body: unknown) => {
  const text = Buffer.isBuffer(body)
    ? body.toString("utf8")
    : body instanceof Uint8Array
      ? Buffer.from(body).toString("utf8")
      : body;
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const ToDeadLetterMessage = (message: ServiceBusReceivedMessage): DeadLetterMessage => ({
  sequenceNumber: message.sequenceNumber?.toString() ?? "",
  messageId: message.messageId?.toString(),
  enqueuedTime: message.enqueuedTimeUtc?.toISOString(),
  deadLetterReason: message.deadLetterReason,
  deadLetterErrorDescription: message.deadLetterErrorDescription,
  deliveryCount: message.deliveryCount,
  subject: message.subject,
  correlationId: message.correlationId?.toString(),
  contentType: message.contentType,
  applicationProperties: message.applicationProperties as Record<string, unknown> | undefined,
  body: DecodeBody(message.body),
});

/** Peeks (does not receive or lock) messages from the dead-letter sub-queue. */
export const PeekDeadLetters = async (credential: TokenCredential, entity: ServiceBusEntity, maxMessages = 50) => {
  const client = new ServiceBusClient(`${entity.namespace}.servicebus.windows.net`, credential);
  try {
    const receiver =
      entity.kind === "queue"
        ? client.createReceiver(entity.entityName, { subQueueType: "deadLetter" })
        : client.createReceiver(entity.entityName, entity.subscriptionName!, { subQueueType: "deadLetter" });
    const messages = await receiver.peekMessages(maxMessages);
    await receiver.close();
    return messages.map(ToDeadLetterMessage);
  } finally {
    await client.close();
  }
};
