import { createHash } from 'node:crypto';
import { ReqCtx, ServiceError } from "../shared.ts";
import { deleteQueueMessage, sendQueueMessage } from "./db-messages.ts";
import { extractMessageAttributes, extractParamArray } from "../params.ts";
import { QueuesCollection } from "./db-queues.ts";
import { receiveQueueMessages } from "./message-stream.ts";

export async function handleSqsQueryAction(ctx: ReqCtx, reqParams: URLSearchParams) {
  switch (reqParams.get('Action')) {

  case 'CreateQueue': {
    const arn = `arn:aws:sqs:${ctx.region}:${ctx.auth.accountId}:${reqParams.get('QueueName')}`;
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
    for (let i = 1; reqParams.has(`Attribute.${i}.Name`); i++) {
      const name = reqParams.get(`Attribute.${i}.Name`);
      const value = reqParams.get(`Attribute.${i}.Value`);
      if (!name || !(name in attributes)) throw new ServiceError(`unimpl`,
        `Queue attribute ${name} not supported`);
      (attributes as Record<string,string>)[name] = `${value}`;
    }
    const tags: Record<string,string> = {};
    for (let i = 1; reqParams.has(`Tag.${i}.Key`); i++) {
      tags[reqParams.get(`Tag.${i}.Key`)!] = reqParams.get(`Tag.${i}.Value`)!;
    }

    const isNamedFifo = arn.endsWith('.fifo');
    if (isNamedFifo !== (attributes['FifoQueue'] == 'true')) {
      throw new ServiceError(`InvalidFifoQueue`,
        `Is "${reqParams.get('QueueName')}" fifo? You said "${attributes['FifoQueue']}"`);
    }
    if (!isNamedFifo && attributes['ContentBasedDeduplication'] !== 'false') {
      throw new ServiceError(`InvalidFifoQueue`,
        `Is "${reqParams.get('QueueName')}" not fifo? You wanted it to have ContentBasedDeduplication`);
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
      "ContentBasedDeduplication": attributes['ContentBasedDeduplication'] == 'true',
      "SqsManagedSseEnabled": attributes['SqsManagedSseEnabled'] == 'true',
    };

    try {
      await QueuesCollection.insertOne({
        _id: arn,
        region: ctx.region,
        accountId: ctx.auth.accountId,
        messagesActive: 0,
        messagesVisible: 0,
        messagesDelayed: 0,
        messagesNotVisible: 0,

        createdAt: new Date,
        modifiedAt: new Date,
        name: reqParams.get('QueueName')!,
        tags: tags,
        config: intendedConfig,
      });
    } catch (err) {
      if ((err as {code?: number}).code == 11000) {
        const existingQueue = await QueuesCollection.findOne({_id: arn});
        if (!existingQueue) throw new Error('what? false creation conflict?');
        // check that everything the user wants is the right value
        for (const [key, intendedVal] of Object.entries(intendedConfig)) {
          if ((existingQueue.config as Record<string,unknown>)[key] !== intendedVal) {
            throw new ServiceError('QueueAlreadyExists', `This queue already exists with a different value for ${key}`);
          }
        }
        // it's ok, we can be idempotent
      } else throw err;
    }

    return `<Result><CreateQueueResult><QueueUrl>https://sqs.${ctx.region}.amazonaws.com/${ctx.auth.accountId}/${reqParams.get('QueueName')!}</QueueUrl></CreateQueueResult></Result>`;
  }

  // case 'SetTopicAttributes':
  //   const matched = await QueuesCollection.updateOne({
  //     _id: reqParams.get('TopicArn')!,
  //   }, {
  //     // TODO: unset if no value
  //     $set: {
  //       [`attributes.${reqParams.get('AttributeName')}`]: reqParams.get('AttributeValue'),
  //     },
  //   });
  //   if (matched < 1) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');
  //   return `<Result />`;

  case 'GetQueueAttributes': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!latest) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');

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
      "FifoQueue": `${latest.config.FifoQueue}`,
      "ContentBasedDeduplication": `${latest.config.ContentBasedDeduplication}`,
    };

    // TODO: filter which attributes we return
    let desiredAttributes: Partial<typeof attributes> = {};
    for (const attributeName of (Array.from(reqParams).filter(x => x[0].startsWith('AttributeName.')).map(x => x[1]))) {
      if (attributeName == 'All') {
        desiredAttributes = attributes;
        break;
      } else if (attributeName in attributes) {
        (desiredAttributes as Record<string,string>)[attributeName] = (attributes as Record<string,string>)[attributeName];
      } else throw new ServiceError(`unimpl`, `Unknown attribute ${attributeName}`)
    }

    return `<Result><GetQueueAttributesResult>
    ${Object.entries(desiredAttributes).filter(x => x[1] !== null).map(pair => `<Attribute>
      <Name>${pair[0]}</Name>
      <Value>${pair[1]}</Value>
    </Attribute>`).join('\n')}</GetQueueAttributesResult></Result>`;
  }

  case 'ListQueueTags': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!latest) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');
    return `<Result><ListQueueTagsResult>
    ${Object.entries(latest.tags).map(pair => `<Tag>
      <Key>${pair[0]}</Key>
      <Value>${pair[1]}</Value>
    </Tag>`).join('\n')}</ListQueueTagsResult></Result>`;
  }

  case 'TagQueue': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const sets: Record<string,string> = {};
    for (let i = 1; reqParams.has(`Tag.${i}.Key`); i++) {
      sets[`tags.${reqParams.get(`Tag.${i}.Key`)}`] = reqParams.get(`Tag.${i}.Value`)!;
    }

    const happened = await QueuesCollection.updateOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    }, {
      $set: sets,
    });
    if (!happened) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');
    return `<Result><TagQueueResult /></Result>`;
  }

  case 'ListQueues': {
    const queues = await QueuesCollection.find({
      region: ctx.region,
      accountId: ctx.auth.accountId,
    }, {
      sort: {name: 1},
    }).toArray();
    return `<Result><ListQueuesResult>${queues.map(x => `<QueueUrl>https://sqs.${x.region}.amazonaws.com/${x.accountId}/${x.name}</QueueUrl>`).join('\n')}</ListQueuesResult></Result>`;
  }

  // case 'DeleteTopic':
  //   const happened = await QueuesCollection.removeAsync({
  //     _id: reqParams.get('TopicArn')!,
  //   });
  //   if (!happened) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');
  //   return `<Result><DeleteTopicResult /></Result>`;





  // data plane

  case 'SendMessage': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!latest) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');

    const { messageId } = await sendQueueMessage(latest, {
      body: reqParams.get('MessageBody'),
      dedupId: reqParams.get('MessageDeduplicationId'),
      groupId: reqParams.get('MessageGroupId'),
      delaySeconds: parseInt(reqParams.get('DelaySeconds') ?? '0'),
      attributes: extractMessageAttributes(reqParams, 'MessageAttribute.'),
      systemAttributes: extractMessageAttributes(reqParams, 'MessageSystemAttribute.'),
    });

    const bodyMd5Hex = createHash('md5').update(reqParams.get('MessageBody') ?? '').digest("hex");
    return `<SendMessageResponse><SendMessageResult>
      <MD5OfMessageBody>${bodyMd5Hex}</MD5OfMessageBody>
      <MessageId>${messageId}</MessageId>
    </SendMessageResult></SendMessageResponse>`;
  }

  case 'SendMessageBatch': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const latest = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!latest) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');

    const results = new Array<string>;
    for (const params of extractParamArray(reqParams, 'SendMessageBatchRequestEntry.', '.Id')) {
      const msgId = params.get('Id');
      const bodyMd5Hex = createHash('md5').update(params.get('MessageBody') ?? '').digest("hex");
      try {
        const { messageId } = await sendQueueMessage(latest, {
          body: params.get('MessageBody'),
          dedupId: params.get('MessageDeduplicationId'),
          groupId: params.get('MessageGroupId'),
          delaySeconds: parseInt(params.get('DelaySeconds') ?? '0'),
          attributes: extractMessageAttributes(params, 'MessageAttribute.'),
          systemAttributes: extractMessageAttributes(params, 'MessageSystemAttribute.'),
        });
        results.push(`
          <SendMessageBatchResultEntry>
            <Id>${msgId}</Id>
            <MessageId>${messageId}</MessageId>
            <MD5OfMessageBody>${bodyMd5Hex}</MD5OfMessageBody>
          </SendMessageBatchResultEntry>`);
      } catch (err) {
        if (!(err instanceof ServiceError)) throw err;
        results.push(`
          <BatchResultErrorEntry>
            <Id>${msgId}</Id>
            <Code>${err.error}</Code>
            <Message>${err.reason}</Message>
            <SenderFault>true</SenderFault>
            <MD5OfMessageBody>${bodyMd5Hex}</MD5OfMessageBody>
          </BatchResultErrorEntry>`);
      }
    }

    return `<SendMessageBatchResponse><SendMessageBatchResult>${results.join('')}</SendMessageBatchResult></SendMessageBatchResponse>`;
  }

  case 'ReceiveMessage': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!queue) {
      // Avoid thundering herd when no queues exist
      await new Promise(ok => setTimeout(ok, 5000 + Math.round(Math.random() * 5000)));
      throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');
    }

    const maxMsgs = parseInt(
      reqParams.get('MaxNumberOfMessages')
      ?? '1');
    const maxSeconds = parseInt(
      reqParams.get('WaitTimeSeconds')
      ?? `${queue.config.ReceiveMessageWaitTimeSeconds}`);

    const messages = await receiveQueueMessages(queue, maxMsgs, maxSeconds);

    await QueuesCollection.updateOne({
      _id: queue._id,
    }, {
      $set: {
        'lastPolledAt': new Date(),
      },
    });

    if (messages.length > 0) {
      console.log('Returning messages:', messages.map(x => x._id));
    }
    return `<Response><ReceiveMessageResult>${messages.map(msg => `
    <Message>
      <MessageId>${msg._id}</MessageId>
      <ReceiptHandle>${msg._id}/${msg.totalDeliveries}</ReceiptHandle>
      <MD5OfBody>${createHash('md5').update(msg.body).digest("hex")}</MD5OfBody>
      <Body>${escapeForXml(msg.body)}</Body>${
      Object.entries(msg.attributes).map(pair => `
      <MessageAttribute>
        <Name>${pair[0]}</Name>
        <Value>
          <DataType>${pair[1].dataType}</DataType>
          <StringValue>${pair[1].value}</StringValue>
        </Value>
      </MessageAttribute>
      `).join('')}
      <Attribute>
        <Name>SenderId</Name>
        <Value>TODO</Value>
      </Attribute>
      <Attribute>
        <Name>SentTimestamp</Name>
        <Value>${msg.createdAt.valueOf()}</Value>
      </Attribute>
      <Attribute>
        <Name>ApproximateReceiveCount</Name>
        <Value>${msg.totalDeliveries}</Value>
      </Attribute>${msg.firstDeliveredAt ? `
      <Attribute>
        <Name>ApproximateFirstReceiveTimestamp</Name>
        <Value>${msg.firstDeliveredAt?.valueOf()}</Value>
      </Attribute>` : ``}
    </Message>
    `).join('')}</ReceiveMessageResult></Response>`;
  }

  case 'DeleteMessage': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!queue) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');

    await deleteQueueMessage(queue, reqParams.get('ReceiptHandle')!);
    return '<Response />';
  }

  case 'DeleteMessageBatch': {
    const queueName = reqParams.get('QueueUrl')!.split('/').slice(-1)[0];
    const queue = await QueuesCollection.findOne({
      region: ctx.region,
      accountId: ctx.auth.accountId,
      name: queueName,
    });
    if (!queue) throw new ServiceError('QueueDoesNotExist', 'Queue with the given name was not found.');

    const results = new Array<string>;
    for (const params of extractParamArray(reqParams, 'DeleteMessageBatchRequestEntry.', '.Id')) {
      const msgId = params.get('Id');
      try {
        await deleteQueueMessage(queue, params.get('ReceiptHandle')!);
        results.push(`
          <BatchResultErrorEntry>
            <Id>${msgId}</Id>
          </BatchResultErrorEntry>`);
      } catch (err) {
        if (!(err instanceof ServiceError)) throw err;
        results.push(`
          <DeleteMessageBatchResultEntry>
            <Id>${msgId}</Id>
            <Code>${err.error}</Code>
            <Message>${err.reason}</Message>
            <SenderFault>true</SenderFault>
          </DeleteMessageBatchResultEntry>`);
      }
    }

    return `<Response><DeleteMessageBatchResult>${results.join('')}</DeleteMessageBatchResult></Response>`;
  }


  default:
    throw new ServiceError(`Unimplemented`, `Unimplemented: ${reqParams.get('Action')}`);
  }
}


function escapeForXml(string: string, ignore?: string) {
  if (string === null || string === undefined) return;
  ignore = (ignore || '').replace(/[^&"<>\']/g, '');
  const pattern = '([&"<>\'])'.replace(new RegExp('[' + ignore + ']', 'g'), '');
  return string.replace(new RegExp(pattern, 'g'), (_, item)  => escapeMap[item] ?? item);
}
const escapeMap: Record<string,string|undefined> = {
  '>': '&gt;',
  '<': '&lt;',
  "'": '&apos;',
  '"': '&quot;',
  '&': '&amp;',
}
