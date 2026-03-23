import { mongoDb, random, ServiceError } from "../shared.ts";
import { TopicSubscriptionsCollection } from "./db-subscriptions.ts";
import { Topic } from "./db-topics.ts";

export type TopicMessageAttribute = {
  dataType: 'String';
  value: string;
};

export interface TopicMessage {
  _id: string;
  topicId: string;
  createdAt: Date;
  modifiedAt: Date;

  undeliveredTo: Array<string>;
  deliveredTo: Array<string>;
  lastDeliveredAt?: Date;

  subject?: string;
  body: string;
  groupId?: string;
  dedupId?: string;
  attributes: Record<string, TopicMessageAttribute>;
  messageStructure?: 'json';
  // PhoneNumber, Subject, TargetArn,
}

export const TopicMessagesCollection = mongoDb.collection<TopicMessage>('sns-TopicMessages');

export async function sendTopicMessage(
  topic: Topic,
  message: {
    subject?: string | null;
    body?: string | null;
    dedupId?: string | null;
    groupId?: string | null;
    messageStructure?: string | null;
  } & Partial<Pick<TopicMessage,
    | 'attributes'
  >>,
) {
  if (!message.body) throw new ServiceError(`no-body`, `body is required`);

  if (topic.config.FifoTopic) {
    if (!message.groupId) throw new ServiceError(`fifo`,
      `This is a fifo Topic`);
    // TODO: ContentBasedDeduplication doesn't seem to set properly
    // if (topic.config.ContentBasedDeduplication && !message.dedupId) throw new ServiceError(`fifo`,
    //   `This fifo Topic requires a MessageDeduplicationId because ContentBasedDeduplication is not set`);
  } else {
    if (message.groupId || message.dedupId) throw new ServiceError(`fifo`, `Is not a fifo Topic`);
  }

  const messageId = await insertTopicMessage({
    topicId: topic._id,

    subject: message.subject ?? undefined,
    body: message.body,
    dedupId: message.dedupId ?? undefined,
    groupId: message.groupId ?? undefined,
    attributes: message.attributes ?? {},
  });

  return {
    messageId,
  };
}

export async function insertTopicMessage(
  opts: Pick<TopicMessage,
    | 'topicId' | 'dedupId' | 'groupId' | 'subject' | 'body' | 'attributes' | 'messageStructure'
  >,
) {
  return await TopicMessagesCollection.insertOne({
    _id: random.id(),
    ...opts,
    createdAt: new Date,
    modifiedAt: new Date,

    undeliveredTo: await TopicSubscriptionsCollection.find({topicId: opts.topicId}).map(x => x._id).toArray(),
    deliveredTo: [],
  });
}
