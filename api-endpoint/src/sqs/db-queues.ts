import { mongoDb } from "../shared.ts";
import { QueueMessagesCollection } from "./db-messages.ts";

export interface Queue {
  _id: string;
  region: string;
  accountId: string;
  name: string;
  // attributes: Record<string,string>;
  tags: Record<string,string>;
  createdAt: Date;
  modifiedAt: Date;
  lastPolledAt?: Date;

  messagesActive: number;
  messagesVisible: number;
  messagesDelayed: number;
  messagesNotVisible: number;

  // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SetQueueAttributes.html
  config: {
    "Policy": string; // a whole-ass IAM document
    "RedrivePolicy": string; // deadLetterTargetArn, maxReceiveCount
    // RedriveAllowPolicy
    "DelaySeconds": number;
    "MaximumMessageSize": number;
    "MessageRetentionPeriod": number;
    "ReceiveMessageWaitTimeSeconds": number;
    "SqsManagedSseEnabled": boolean;
    // KmsMasterKeyId
    // KmsDataKeyReusePeriodSeconds
    "VisibilityTimeout": number;
    "FifoQueue": boolean;
    // "FifoThroughputLimit"?: "perQueue" | "perMessageGroupId";
    "ContentBasedDeduplication": boolean;
    // "DeduplicationScope"?: "messageGroup" | "queue";
  };
}

export const QueuesCollection = mongoDb.collection<Queue>('sqs-Queues');


setInterval(async () => {
  const queues = new Map<string, {
    visible: number;
    invisible: number;
    delayed: number;
  }>();

  for await (const x of QueueMessagesCollection.find({lifecycle: {$in: ['Waiting', 'Delivered']}})) {
    let obj = queues.get(x.queueId);
    if (!obj) queues.set(x.queueId, obj = {
      visible: 0,
      invisible: 0,
      delayed: 0,
    });

    if (x.visibleAfter && x.visibleAfter?.valueOf() < Date.now()) {
      obj.visible++;
    } else if (x.lifecycle == 'Delivered') {
      obj.invisible++;
    } else {
      obj.delayed++;
    }
  }

  for (const [queueId, counts] of queues) {
    await QueuesCollection.updateOne({
      _id: queueId,
    }, {
      $set: {
        messagesActive: counts.delayed + counts.invisible + counts.visible,
        messagesVisible: counts.visible,
        messagesDelayed: counts.delayed,
        messagesNotVisible: counts.invisible,
      },
    });
  }

  await QueuesCollection.updateMany({
    _id: {$nin: Array.from(queues.keys())},
  }, {
    $set: {
      messagesActive: 0,
      messagesVisible: 0,
      messagesDelayed: 0,
      messagesNotVisible: 0,
     }
  });
}, 10 * 1000);
