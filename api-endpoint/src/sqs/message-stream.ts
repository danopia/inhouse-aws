import { ChangeStream, ChangeStreamDocument } from "mongodb";
import { QueueMessage, QueueMessagesCollection } from "./db-messages.ts";
import { Queue } from "./db-queues.ts";

export class MessageReceiver {
  constructor(
    public readonly deadline: Date,
    public readonly maxMessages: number,
  ) {}
  public readonly availMessages: Array<QueueMessage> = [];
  markDone!: (value: Array<QueueMessage>) => void;
  public readonly isDone = new Promise<Array<QueueMessage>>(ok => this.markDone = ok);

  flushTimer: number | null = null;
  flush() {
    if (!this.availMessages.length) return;
    console.log('Flushing', this.availMessages.map(x => x._id), 'available messages');
    this.markDone([...this.availMessages]);
    this.availMessages.length = 0;
  }

  receiveMessage(msg: QueueMessage): boolean {
    this.availMessages.push(msg);
    if (this.availMessages.length >= this.maxMessages) {
      this.flush();
      return true;
    }
    this.flushTimer ??= setTimeout(() => {
      this.flush();
    }, 100);
    return false;
  }
}

const changeStream = QueueMessagesCollection.watch([
  { $match: {
      // 'fullDocument.queueId': queueId,
      // 'fullDocument.lifecycle': 'Waiting',
    }},
  // { sort: { visibleAfter: 1 }, },
  // { $limit: 10 },
// limit: Math.min(maxMessages, 10),
], {
  fullDocument: "updateLookup",
});

export class QueueStream {
  receivers = new Set<MessageReceiver>;
  // changeStream: ChangeStream<QueueMessage>;
  readyToTake = new Array<QueueMessage>;
  constructor(
    public readonly queueId: string,
  ) {
    // const pipeline = [ { $match: { runtime: { $lt: 15 } } } ];

    changeStream.addListener('change', x => {
      // console.log(x.operationType, x.documentKey._id);
      if (x.operationType == 'insert') {
        if (x.fullDocument.queueId != queueId) return;
        for (const receiver of this.receivers) {
          if (receiver.receiveMessage(x.fullDocument)) {
            // console.log('delivered readyToTake', x.documentKey._id);
            return;
          }
        }
        this.readyToTake.push(x.fullDocument);
        // console.log('added readyToTake', x.documentKey._id);
      }
      if (x.operationType == 'update') {
        if (x.fullDocument?.queueId != queueId) return;
        if (x.fullDocument.lifecycle == 'Waiting') {
          for (const receiver of this.receivers) {
            if (receiver.receiveMessage(x.fullDocument)) {
              // console.log('delivered readyToTake', x.documentKey._id);
              return;
            }
          }
          this.readyToTake.push(x.fullDocument);
          // console.log('added readyToTake', x.documentKey._id);
        } else {
          const idx = this.readyToTake.findIndex(y => y._id == x.documentKey._id);
          // console.log('removing readyToTake', idx)
          if (idx >= 0) this.readyToTake.splice(idx, 1);
        }
      }
      if (x.operationType == 'delete') {
        if (x.fullDocumentBeforeChange?.queueId != queueId) return;
        const idx = this.readyToTake.findIndex(y => y._id == x.documentKey._id);
        // console.log('removing readyToTake', idx)
        if (idx >= 0) this.readyToTake.splice(idx, 1);
      }
    });

    // console.log('setup message changestream for', queueId);
  }

  async grabSome(maxMessages: number, maxSeconds: number): Promise<Array<QueueMessage>> {
    const readyMsgs = this.readyToTake.splice(0, 10);
    if (readyMsgs.length > 0) return readyMsgs;

    const availMessages = await QueueMessagesCollection.find({
      queueId: this.queueId,
      lifecycle: 'Waiting',
    }, {
      sort: { visibleAfter: 1 },
      limit: Math.max(Math.min(maxMessages, 10), 1),
    }).toArray();
    if (availMessages.length > 0) return availMessages;
    // await new Promise(ok => AbortSignal.timeout(maxSeconds * 1000).addEventListener('abort', ok));

    if (!maxSeconds) return [];

    const receiver = new MessageReceiver(new Date(Date.now() + (maxSeconds * 1000)), maxMessages);
    this.receivers.add(receiver);
    return await receiver.isDone;
  }
}

const QueueStreams = new Map<string,QueueStream>;

export function getQueueStream(queueId: string) {
  let qs = QueueStreams.get(queueId);
  if (!qs) {
    QueueStreams.set(queueId, qs = new QueueStream(queueId));
  }
  return qs;
}


// export async function receiveQueueMessagesWithWait(
//   queue: Queue,
//   maxMessages: number,
//   maxSeconds: number,
// ) {
//   // const returnAfter = new Date(Date.now() + (maxSeconds * 1000));


export async function receiveQueueMessages(
  queue: Queue,
  maxMessages: number,
  maxSeconds: number,
) {
  // const returnAfter = new Date(Date.now() + (maxSeconds * 1000));

  const queueStream = getQueueStream(queue._id);
  const availMessages = await queueStream.grabSome(maxMessages, maxSeconds);
  return await attemptQueueMessageDelivery(queue, availMessages);

}

async function attemptQueueMessageDelivery(
  queue: Queue,
  availMessages: Array<QueueMessage>,
) {
  const delivarables: Array<QueueMessage> = [];
  // update in loop because lack of https://feedback.mongodb.com/forums/924280-database/suggestions/46072024-how-to-limit-the-number-of-document-updates
  for (const msg of availMessages) {
    console.log('Considering delivering', msg._id);
    if (await QueueMessagesCollection.updateOne({
      _id: msg._id,
      lifecycle: msg.lifecycle,
      lastDeliveredAt: msg.lastDeliveredAt,
    }, {
      $set: {
        lifecycle: 'Delivered',
        firstDeliveredAt: msg.firstDeliveredAt ?? new Date,
        lastDeliveredAt: new Date,
        visibleAfter: new Date(Date.now() + (queue.config.VisibilityTimeout*1000)),
      },
      $inc: {
        totalDeliveries: 1,
      },
    })) {
      delivarables.push(msg);
    }
  }
  return delivarables;
}
