import { mongoDb, random, ServiceError } from "../shared.ts";
import { Queue } from "./db-queues.ts";
import { getQueueStream } from "./message-stream.ts";


export type QueueMessageAttribute = {
  dataType: 'String';
  value: string;
} | {
  dataType: 'Binary';
  value: Uint8Array;
};

export interface QueueMessage {
  _id: string;
  queueId: string;
  createdAt: Date;
  modifiedAt: Date;

  lifecycle: 'Delayed' | 'Waiting' | 'Delivered' | 'Deleted';
  firstDeliveredAt?: Date;
  lastDeliveredAt?: Date;
  deletedAt?: Date;
  visibleAfter?: Date | null;
  totalDeliveries: number;

  body: string;
  delaySeconds: number;
  groupId?: string;
  dedupId?: string;
  attributes: Record<string, QueueMessageAttribute>;
  systemAttributes: Record<string, QueueMessageAttribute>;
}

export const QueueMessagesCollection = mongoDb.collection<QueueMessage>('sqs-QueueMessages');

export async function sendQueueMessage(
  queue: Queue,
  message: {
    body?: string | null;
    dedupId?: string | null;
    groupId?: string | null;
  } & Partial<Pick<QueueMessage,
    | 'delaySeconds'
    | 'attributes'
    | 'systemAttributes'
  >>,
) {
  if (!message.body) throw new ServiceError(`validation`, `body is required`);

  // check(message.delaySeconds, Number);

  if (queue.config.FifoQueue) {
    if (!message.groupId) throw new ServiceError(`fifo`, `This is a fifo queue`);
    // TODO: ContentBasedDeduplication doesn't seem to set properly
    // if (queue.config.ContentBasedDeduplication && !message.dedupId) throw new ServiceError(`fifo`,
    //   `This fifo queue requires a MessageDeduplicationId because ContentBasedDeduplication is not set`);
  } else {
    if (message.groupId || message.dedupId) throw new ServiceError(`fifo`, `Is not a fifo queue`);
  }

  // TODO: check that systemAttrs only has AWSTraceHeader if anything

  const messageId = await insertQueueMessage({
    queueId: queue._id,

    body: message.body,
    dedupId: message.dedupId ?? undefined,
    groupId: message.groupId ?? undefined,

    delaySeconds: message.delaySeconds ?? 0,
    attributes: message.attributes ?? {},
    systemAttributes: message.systemAttributes ?? {},
  });

  return {
    messageId,
  };
}

export async function insertQueueMessage(
  opts: Pick<QueueMessage,
    | 'queueId' | 'dedupId' | 'groupId' | 'body' | 'delaySeconds' | 'attributes' | 'systemAttributes'
  >,
) {
  return await QueueMessagesCollection.insertOne({
    _id: random.id(),
    ...opts,
    createdAt: new Date,
    modifiedAt: new Date,
    totalDeliveries: 0,

    ...opts.delaySeconds
      ? {
        lifecycle: 'Delayed',
        visibleAfter: new Date(Date.now() + (opts.delaySeconds * 1000)),
      } : {
        lifecycle: 'Waiting'
      },
  });
}

// export async function receiveQueueMessagesOnce(
//   queue: Queue,
//   maxMessages: number,
// ) {
//   const availMessages = await QueueMessagesCollection.find({
//     queueId: queue._id,
//     lifecycle: 'Waiting',
//   }, {
//     sort: { visibleAfter: 1 },
//     limit: Math.min(maxMessages, 10),
//   }).toArray();
//   return await attemptQueueMessageDelivery(queue, availMessages);
// }

// export async function receiveQueueMessagesWithWait(
//   queue: Queue,
//   maxMessages: number,
//   maxSeconds: number,
// ) {
//   // const returnAfter = new Date(Date.now() + (maxSeconds * 1000));

//   const queueStream = getQueueStream(queue._id);
//   const availMessages = await queueStream.grabSome(maxMessages, maxSeconds);
//   return await attemptQueueMessageDelivery(queue, availMessages);

  // // const pipeline = [ { $match: { runtime: { $lt: 15 } } } ];
  // const changeStream = QueueMessagesCollection.watch([{
  //   $match: {
  //     queueId: queue._id,
  //     visibleAfter: {$lt: new Date()},
  //     lifecycle: {$ne: 'Deleted'},
  //   },
  //   // sort: { visibleAfter: 1 },
  //   // limit: Math.min(maxMessages, 10),
  // }], {
  //   fullDocument: "updateLookup",
  // });

  // // const abortTimeout = AbortSignal.timeout(maxSeconds * 1000);
  // const abortCtlr = new AbortController();
  // AbortSignal.any([
  //   abortCtlr.signal,
  //   AbortSignal.timeout(maxSeconds * 1000),
  // ]).addEventListener('abort', () => changeStream.close());

  // let earlyStopTimer: number;

  // const availMessages: Array<QueueMessage> = [];
  // try {
  //   for await (const message of changeStream) {
  //     console.log(message);
  //     // availMessages.push(message);
  //     // if
  //     earlyStopTimer ??= setTimeout(() => abortCtlr.abort('earlyStopTimer'), 100);
  //     if (availMessages.length >= maxMessages) {

  //     }
  //   }

  //   // const firstTry = await receiveQueueMessages(queue, maxMsgs);
  //   // if (firstTry.length > 0) return firstTry;

  //   // while (returnAfter > new Date) {
  //   //   const tryAgain = await receiveQueueMessages(queue, maxMsgs);
  //   //   if (tryAgain.length > 0) return tryAgain;

  //   //   await new Promise(ok => setTimeout(ok, 2000));
  //   // }

  //   // return [];

  // } finally {
  //   changeStream.close();
  // }

  // const delivarables: Array<QueueMessage> = [];
  // // update in loop because lack of https://feedback.mongodb.com/forums/924280-database/suggestions/46072024-how-to-limit-the-number-of-document-updates
  // for (const msg of availMessages) {
  //   console.log('Considering delivering', msg._id);
  //   if (await QueueMessagesCollection.updateOne({
  //     _id: msg._id,
  //     lifecycle: msg.lifecycle,
  //     lastDeliveredAt: msg.lastDeliveredAt,
  //   }, {
  //     $set: {
  //       lifecycle: 'Delivered',
  //       firstDeliveredAt: msg.firstDeliveredAt ?? new Date,
  //       lastDeliveredAt: new Date,
  //       visibleAfter: new Date(Date.now() + (queue.config.VisibilityTimeout*1000)),
  //     },
  //     $inc: {
  //       totalDeliveries: 1,
  //     },
  //   })) {
  //     delivarables.push(msg);
  //   }
  // }
  // return delivarables;
// }

export async function deleteQueueMessage(queue: Queue, handle: string) {
  const [msgId, receives] = handle.split('/');

  const hit = await QueueMessagesCollection.updateOne({
    _id: msgId,
    queueId: queue._id,
    totalDeliveries: parseInt(receives)+1,
    lifecycle: 'Delivered',
  }, {
    $set: {
      lifecycle: 'Deleted',
      deletedAt: new Date,
      modifiedAt: new Date,
    },
    $unset: {
      visibleAfter: 1,
    },
  });

  if (!hit) throw new ServiceError(`ReceiptHandleIsInvalid`,
    `Failed to find deletable message.`);
}

// TODO: should be based on changestream instead
setInterval(async () => {
  for await (const x of QueueMessagesCollection.find({
    visibleAfter: {$lt: new Date},
    lifecycle: {$in: ['Delayed', 'Delivered']},
  })) {
    await QueueMessagesCollection.updateOne({
      _id: x._id,
    }, {
      $set: {
        lifecycle: 'Waiting',
      },
    });
  }
}, 2.5 * 1000);
