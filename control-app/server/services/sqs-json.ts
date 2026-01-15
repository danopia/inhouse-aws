import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { createHash } from 'node:crypto';
import { deleteQueueMessage, QueueMessagesCollection, receiveQueueMessages, sendQueueMessage } from "/imports/db/queue-messages";
import { Queue, QueuesCollection } from "/imports/db/queues";

import type {
  CreateQueueRequest,
  DeleteMessageBatchRequest,
  DeleteMessageBatchResult,
  DeleteMessageRequest,
  DeleteQueueRequest,
  GetQueueAttributesRequest,
  GetQueueAttributesResult,
  ListQueuesRequest,
  ListQueuesResult,
  ListQueueTagsRequest,
  ListQueueTagsResult,
  MessageAttributeValue,
  QueueAttributeName,
  ReceiveMessageRequest,
  SendMessageBatchRequest,
  SendMessageBatchResult,
  SendMessageRequest,
  SendMessageResult,
  TagQueueRequest,
} from "./sqs-json-types";

const extractMessageAttributesJson = (attributes: {
  [key: string]: MessageAttributeValue | null | undefined;
} | null | undefined) => Object
  .fromEntries(Object.entries(attributes ?? {})
    .map(([name, data]) => {
      const dataType = data?.[`DataType`];
      switch (dataType) {
        case 'String':
          return [name, {
            dataType: 'String' as const,
            value: data![`StringValue`],
          }];
        case 'Binary':
          return [name, {
            dataType: 'Binary' as const,
            value: Buffer.from(data![`BinaryValue`] as string, 'base64'),
          }];
        default: throw new Meteor.Error(`unimpl`, `TODO: attribute data type ${dataType}`);
      }
    }));


// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_DeleteMessageBatch.html

export async function handleSqsJsonAction(action: string, reqBody: string, accountId: string, region: string) {
  const rawRequest = JSON.parse(reqBody);
  switch (action) {

  case 'CreateQueue': {
    const reqParams = rawRequest as CreateQueueRequest;

    const arn = `arn:aws:sqs:${region}:${accountId}:${reqParams['QueueName']}`;
    const attributes = {
      "FifoQueue": "false",
      "ContentBasedDeduplication": "false",
      "ApproximateNumberOfMessages": "0",
      "ApproximateNumberOfMessagesDelayed": "0",
      "ApproximateNumberOfMessagesNotVisible": "0",
      "DelaySeconds": "0",
      "MaximumMessageSize": "262144",
      "MessageRetentionPeriod": "345600",
      "Policy": "{\"Version\":\"2012-10-17\"}",
      "ReceiveMessageWaitTimeSeconds": "0",
      "RedrivePolicy": "{}",
      "SqsManagedSseEnabled": "false",
      "VisibilityTimeout": "30",
    };
    for (const [name, value] of Object.entries(reqParams['Attributes'] ?? [])) {
      if (!name || !(name in attributes)) throw new Meteor.Error(`unimpl`,
        `Queue attribute ${name} not supported`);
      (attributes as Record<string,string>)[name] = `${value}`;
    }
    const tags: Record<string,string> = {};
    for (const [key, value] of Object.entries(reqParams['tags'] ?? [])) {
      tags[key] = `${value}`;
    }

    const isNamedFifo = arn.endsWith('.fifo');
    if (isNamedFifo !== (attributes['FifoQueue'] == 'true')) {
      throw new Meteor.Error(`InvalidFifoQueue`,
        `Is "${reqParams['QueueName']}" fifo? You said "${attributes['FifoQueue']}"`);
    }
    if (!isNamedFifo && attributes['ContentBasedDeduplication'] !== 'false') {
      throw new Meteor.Error(`InvalidFifoQueue`,
        `Is "${reqParams['QueueName']}" not fifo? You wanted it to have ContentBasedDeduplication`);
    }

    const intendedConfig = {
      "Policy": attributes['Policy'],
      "RedrivePolicy": attributes['RedrivePolicy'],
      "DelaySeconds": parseInt(attributes['DelaySeconds']),
      "MaximumMessageSize": parseInt(attributes['MaximumMessageSize']),
      "MessageRetentionPeriod": parseInt(attributes['MessageRetentionPeriod']),
      "ReceiveMessageWaitTimeSeconds": parseInt(attributes['ReceiveMessageWaitTimeSeconds']),
      "VisibilityTimeout": parseInt(attributes['VisibilityTimeout']),
      "FifoQueue": attributes['FifoQueue'] == 'true',
      "SqsManagedSseEnabled": attributes['SqsManagedSseEnabled'] == 'true',
      "ContentBasedDeduplication": attributes['ContentBasedDeduplication'] == 'true',
    };

    try {
      await QueuesCollection.insertAsync({
        _id: arn,
        region,
        accountId,

        messagesActive: 0,
        messagesVisible: 0,
        messagesDelayed: 0,
        messagesNotVisible: 0,

        createdAt: new Date,
        modifiedAt: new Date,
        name: reqParams['QueueName']!,
        tags: tags,
        config: intendedConfig,
      });
    } catch (err) {
      if ((err as {code?: number}).code == 11000) {
        const existingQueue = await QueuesCollection.findOneAsync({_id: arn});
        if (!existingQueue) throw new Error('what? false creation conflict?');
        // check that everything the user wants is the right value
        for (const [key, intendedVal] of Object.entries(intendedConfig)) {
          if ((existingQueue.config as Record<string,unknown>)[key] !== intendedVal) {
            throw new Meteor.Error('QueueAlreadyExists', `This queue already exists with a different value for ${key}`);
          }
        }
        // it's ok, we can be idempotent
      } else throw err;
    }

    return JSON.stringify({
      QueueUrl: `https://sqs.${region}.amazonaws.com/${accountId}/${reqParams['QueueName']!}`,
    });
  }

  // case 'SetTopicAttributes':
  //   const matched = await QueuesCollection.updateAsync({
  //     _id: reqParams['TopicArn']!,
  //   }, {
  //     // TODO: unset if no value
  //     $set: {
  //       [`attributes.${reqParams['AttributeName']}`]: reqParams['AttributeValue'],
  //     },
  //   });
  //   if (matched < 1) throw new Meteor.Error(404, 'no-queue');
  //   return `<Result />`;

  case 'GetQueueAttributes': {
    const reqParams = rawRequest as GetQueueAttributesRequest;
    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!latest) throw new Meteor.Error(404, 'no-queue');

    const attributes = {
      "QueueArn": latest._id,
      "CreatedTimestamp": `${Math.floor(latest.createdAt.valueOf() / 1000)}`,
      "LastModifiedTimestamp": `${Math.floor(latest.modifiedAt.valueOf() / 1000)}`,

      "ApproximateNumberOfMessages": "0",
      "ApproximateNumberOfMessagesDelayed": "0",
      "ApproximateNumberOfMessagesNotVisible": "0",

      "Policy": latest.config.Policy,
      "RedrivePolicy": latest.config.RedrivePolicy == '{}' ? null : latest.config.RedrivePolicy,
      "DelaySeconds": `${latest.config.DelaySeconds}`,
      "MaximumMessageSize": `${latest.config.MaximumMessageSize}`,
      "MessageRetentionPeriod": `${latest.config.MessageRetentionPeriod}`,
      "ReceiveMessageWaitTimeSeconds": `${latest.config.ReceiveMessageWaitTimeSeconds}`,
      "VisibilityTimeout": `${latest.config.VisibilityTimeout}`,
      "SqsManagedSseEnabled": `${latest.config.SqsManagedSseEnabled ?? false}`,
      "FifoQueue": `${latest.config.FifoQueue ?? false}`,
      "ContentBasedDeduplication": `${latest.config.ContentBasedDeduplication}`,
    } as { [key in QueueAttributeName]: string | null | undefined };

    // TODO: filter which attributes we return
    let desiredAttributes = {} as { [key in QueueAttributeName]: string | null | undefined };
    for (const attributeName of reqParams['AttributeNames'] ?? (Object.entries(reqParams).filter(x => x[0].startsWith('AttributeName.')).map(x => x[1] as string))) {
      if (attributeName == 'All') {
        desiredAttributes = attributes;
        break;
      } else if (attributeName in attributes) {
        (desiredAttributes as Record<string,string>)[attributeName] = (attributes as Record<string,string>)[attributeName];
      } else throw new Meteor.Error(`unimpl`, `Unknown attribute ${attributeName}`)
    }

    return JSON.stringify({
      Attributes: desiredAttributes,
    } satisfies GetQueueAttributesResult);
  }

  case 'ListQueueTags': {
    const reqParams = rawRequest as ListQueueTagsRequest;
    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!latest) throw new Meteor.Error(404, 'no-queue');

    return JSON.stringify({
      Tags: latest.tags,
    } satisfies ListQueueTagsResult);
  }

  case 'TagQueue': {
    const reqParams = rawRequest as TagQueueRequest;

    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const sets: Record<string,string> = {};
    // @ts-expect-error TODO: why was this lowercase once?
    for (const [key, value] of Object.entries(reqParams['tags'] ?? reqParams['Tags'] ?? [])) {
      sets[key] = `${value}`;
    }

    const happened = await QueuesCollection.updateAsync({
      region, accountId,
      name: queueName,
    }, {
      $set: sets,
    });
    if (!happened) throw new Meteor.Error(404, 'no-queue');

    return JSON.stringify({});
  }

  case 'ListQueues': {
    const reqParams = rawRequest as ListQueuesRequest;

    const queues = await QueuesCollection.find({
      region, accountId,
    }, {
      sort: {name: 1},
      limit: reqParams.MaxResults ?? 1000,
    }).fetchAsync();

    return JSON.stringify({
      QueueUrls: queues.map(x => `https://sqs.${x.region}.amazonaws.com/${x.accountId}/${x.name}`),
    } satisfies ListQueuesResult);
  }

  case 'DeleteQueue': {
    const reqParams = rawRequest as DeleteQueueRequest;

    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!queue) throw new Meteor.Error(404, 'no-queue');

    await QueueMessagesCollection.removeAsync({
      queueId: queue._id,
    })
    await QueuesCollection.removeAsync({
      _id: queue._id,
    });

    return JSON.stringify({});
  }




  // data plane

  case 'SendMessage': {
    const reqParams = rawRequest as SendMessageRequest;

    const queueName = reqParams['QueueUrl'].split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!latest) throw new Meteor.Error(404, 'no-queue');

    const { messageId } = await sendQueueMessage(latest, {
      body: reqParams['MessageBody'],
      dedupId: reqParams['MessageDeduplicationId'],
      groupId: reqParams['MessageGroupId'],
      delaySeconds: reqParams['DelaySeconds'] ?? 0,
      attributes: extractMessageAttributesJson(reqParams['MessageAttributes']),
      systemAttributes: extractMessageAttributesJson(reqParams['MessageSystemAttributes']),
    });

    const bodyMd5Hex = createHash('md5').update(reqParams['MessageBody'] ?? '').digest("hex");

    return JSON.stringify({
      MD5OfMessageBody: bodyMd5Hex,
      MessageId: messageId,
    } satisfies SendMessageResult);
  }

  case 'SendMessageBatch': {
    const reqParams = rawRequest as SendMessageBatchRequest;

    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!latest) throw new Meteor.Error(404, 'no-queue');

    const resultsJson: SendMessageBatchResult = {
      Successful: [],
      Failed: [],
    };
    for (const params of reqParams['Entries']) {
      const msgId = params['Id'];
      if (!msgId) throw new Error(`Batch message ID not provided`);
      const bodyMd5Hex = createHash('md5').update(params['MessageBody'] ?? '').digest("hex");
      try {
        const { messageId } = await sendQueueMessage(latest, {
          body: params['MessageBody'],
          dedupId: params['MessageDeduplicationId'],
          groupId: params['MessageGroupId'],
          delaySeconds: params['DelaySeconds'] ?? 0,
          attributes: extractMessageAttributesJson(params['MessageAttributes']),
          systemAttributes: extractMessageAttributesJson(params['MessageSystemAttributes']),
        });
        resultsJson.Successful.push({
          Id: msgId,
          MessageId: messageId,
          MD5OfMessageBody: bodyMd5Hex,
        });
      } catch (err) {
        if (!(err instanceof Meteor.Error)) throw err;
        resultsJson.Failed.push({
          Id: msgId,
          Code: `${err.error}`,
          Message: `${err.reason}`,
          SenderFault: true,
          // MD5OfMessageBody: bodyMd5Hex,
        });
      }
    }

    return JSON.stringify(resultsJson);
  }

  case 'ReceiveMessage': {
    const reqParams = rawRequest as ReceiveMessageRequest;

    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!queue) {
      // Avoid thundering herd when no queues exist
      await new Promise(ok => setTimeout(ok, 5000 + Math.round(Math.random() * 5000)));
      throw new Meteor.Error(404, 'no-queue');
    }

    const maxMsgs = reqParams['MaxNumberOfMessages'] ?? 1;
    const maxSeconds = reqParams['WaitTimeSeconds'] ?? queue.config.ReceiveMessageWaitTimeSeconds;
    check(maxMsgs, Number);
    check(maxSeconds, Number);

    const messages = await waitForMessages(queue, maxMsgs, maxSeconds);

    await QueuesCollection.updateAsync({
      _id: queue._id,
    }, {
      $set: {
        'lastPolledAt': new Date(),
      },
    });

    if (messages.length > 0) {
      console.log('Returning messages:', messages.map(x => x._id));
    }

    return JSON.stringify({
      Messages: messages.map(msg => ({
        MessageId: msg._id,
        ReceiptHandle: `${msg._id}/${msg.totalDeliveries}`,
        MD5OfBody: createHash('md5').update(msg.body).digest("hex"),
        Body: msg.body,
        Attributes: {
          SenderId: '000000000000',
          SentTimestamp: msg.createdAt.valueOf(),
          ApproximateReceiveCount: msg.totalDeliveries,
          ApproximateFirstReceiveTimestamp: msg.firstDeliveredAt?.valueOf(),
        },
      }))
    } /*satisfies ReceiveMessageResult*/); // TODO
  }

  case 'DeleteMessage': {
    const reqParams = rawRequest as DeleteMessageRequest;

    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!queue) throw new Meteor.Error(404, 'no-queue');

    await deleteQueueMessage(queue, reqParams['ReceiptHandle']!);

    return JSON.stringify({});
  }

  case 'DeleteMessageBatch': {
    const reqParams = rawRequest as DeleteMessageBatchRequest;

    const queueName = reqParams['QueueUrl']!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOneAsync({
      region, accountId,
      name: queueName,
    });
    if (!queue) throw new Meteor.Error(404, 'no-queue');

    const resultsJson: DeleteMessageBatchResult = {
      Successful: [],
      Failed: [],
    };
    for (const params of reqParams['Entries']) {
      const msgId = params['Id'];
      if (!msgId) throw new Error(`Batch delete ID not provided`);
      try {
        await deleteQueueMessage(queue, params['ReceiptHandle']);
        resultsJson.Successful.push({Id: msgId});
      } catch (err) {
        if (!(err instanceof Meteor.Error)) throw err;
        resultsJson.Failed.push({
          Id: msgId,
          SenderFault: true,
          Code: `${err.error}`,
          Message: `${err.reason}`,
        });
      }
    }

    return JSON.stringify(resultsJson);
  }


  default:
    throw new Meteor.Error(`Unimplemented`, `Unimplemented: ${action}`);
  }
}

async function waitForMessages(queue: Queue, maxMsgs: number, maxSeconds: number) {
  const returnAfter = new Date(Date.now() + (maxSeconds * 1000));

  const firstTry = await receiveQueueMessages(queue, maxMsgs);
  if (firstTry.length > 0) return firstTry;

  while (returnAfter > new Date) {
    const tryAgain = await receiveQueueMessages(queue, maxMsgs);
    if (tryAgain.length > 0) return tryAgain;

    await new Promise(ok => setTimeout(ok, 2000));
  }

  return [];
}

// Meteor.setInterval(async () => {
//   const queues = new Map<string, {
//     visible: number;
//     invisible: number;
//     delayed: number;
//   }>();

//   await QueueMessagesCollection.find({lifecycle: {$in: ['Waiting', 'Delivered']}}).forEachAsync(x => {
//     let obj = queues.get(x.queueId);
//     if (!obj) queues.set(x.queueId, obj = {
//       visible: 0,
//       invisible: 0,
//       delayed: 0,
//     });

//     if (x.visibleAfter && x.visibleAfter?.valueOf() < Date.now()) {
//       obj.visible++;
//     } else if (x.lifecycle == 'Delivered') {
//       obj.invisible++;
//     } else {
//       obj.delayed++;
//     }
//   });

//   for (const [queueId, counts] of queues) {
//     await QueuesCollection.updateAsync({
//       _id: queueId,
//     }, {
//       $set: {
//         messagesActive: counts.delayed + counts.invisible + counts.visible,
//         messagesVisible: counts.visible,
//         messagesDelayed: counts.delayed,
//         messagesNotVisible: counts.invisible,
//       },
//     });
//   }

//   await QueuesCollection.updateAsync({
//     _id: {$nin: Array.from(queues.keys())},
//   }, {
//     $set: {
//       messagesActive: 0,
//       messagesVisible: 0,
//       messagesDelayed: 0,
//       messagesNotVisible: 0,
//      }
//   }, { multi: true });
// }, 10 * 1000);
