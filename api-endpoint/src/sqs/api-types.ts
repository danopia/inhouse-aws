
// refs: 1 - tags: named, input
/**  */
export interface AddPermissionRequest {
  /** The URL of the Amazon SQS queue to which permissions are added. */
  QueueUrl: string;
  /** The unique identification of the permission you're setting (for example, `AliceSendMessage`). */
  Label: string;
  /** The Amazon Web Services account numbers of the [principals](https://docs.aws.amazon.com/general/latest/gr/glos-chap.html#P) who are to receive permission. */
  AWSAccountIds: string[];
  /** The action the client wants to allow for the specified principal. */
  Actions: string[];
}

// refs: 1 - tags: named, input
export interface CancelMessageMoveTaskRequest {
  /** An identifier associated with a message movement task. */
  TaskHandle: string;
}

// refs: 1 - tags: named, input
export interface ChangeMessageVisibilityRequest {
  /** The URL of the Amazon SQS queue whose message's visibility is changed. */
  QueueUrl: string;
  /** The receipt handle associated with the message, whose visibility timeout is changed. */
  ReceiptHandle: string;
  /** The new value for the message's visibility timeout (in seconds). */
  VisibilityTimeout: number;
}

// refs: 1 - tags: named, input
/**  */
export interface ChangeMessageVisibilityBatchRequest {
  /** The URL of the Amazon SQS queue whose messages' visibility is changed. */
  QueueUrl: string;
  /** Lists the receipt handles of the messages for which the visibility timeout must be changed. */
  Entries: ChangeMessageVisibilityBatchRequestEntry[];
}

// refs: 1 - tags: named, input
/**  */
export interface CreateQueueRequest {
  /** The name of the new queue. */
  QueueName: string;
  /** A map of attributes with their corresponding values. */
  Attributes?: { [key in QueueAttributeName]: string | null | undefined } | null;
  /** Add cost allocation tags to the specified Amazon SQS queue. */
  tags?: { [key: string]: string | null | undefined } | null;
}

// refs: 1 - tags: named, input
/**  */
export interface DeleteMessageRequest {
  /** The URL of the Amazon SQS queue from which messages are deleted. */
  QueueUrl: string;
  /** The receipt handle associated with the message to delete. */
  ReceiptHandle: string;
}

// refs: 1 - tags: named, input
/**  */
export interface DeleteMessageBatchRequest {
  /** The URL of the Amazon SQS queue from which messages are deleted. */
  QueueUrl: string;
  /** Lists the receipt handles for the messages to be deleted. */
  Entries: DeleteMessageBatchRequestEntry[];
}

// refs: 1 - tags: named, input
/**  */
export interface DeleteQueueRequest {
  /** The URL of the Amazon SQS queue to delete. */
  QueueUrl: string;
}

// refs: 1 - tags: named, input
/**  */
export interface GetQueueAttributesRequest {
  /** The URL of the Amazon SQS queue whose attribute information is retrieved. */
  QueueUrl: string;
  /** A list of attributes for which to retrieve information. */
  AttributeNames?: QueueAttributeName[] | null;
}

// refs: 1 - tags: named, input
/**  */
export interface GetQueueUrlRequest {
  /** The name of the queue whose URL must be fetched. */
  QueueName: string;
  /** The Amazon Web Services account ID of the account that created the queue. */
  QueueOwnerAWSAccountId?: string | null;
}

// refs: 1 - tags: named, input
/**  */
export interface ListDeadLetterSourceQueuesRequest {
  /** The URL of a dead-letter queue. */
  QueueUrl: string;
  /** Pagination token to request the next set of results. */
  NextToken?: string | null;
  /** Maximum number of results to include in the response. */
  MaxResults?: number | null;
}

// refs: 1 - tags: named, input
export interface ListMessageMoveTasksRequest {
  /** The ARN of the queue whose message movement tasks are to be listed. */
  SourceArn: string;
  /** The maximum number of results to include in the response. */
  MaxResults?: number | null;
}

// refs: 1 - tags: named, input
export interface ListQueueTagsRequest {
  /** The URL of the queue. */
  QueueUrl: string;
}

// refs: 1 - tags: named, input
/**  */
export interface ListQueuesRequest {
  /** A string to use for filtering the list results. */
  QueueNamePrefix?: string | null;
  /** Pagination token to request the next set of results. */
  NextToken?: string | null;
  /** Maximum number of results to include in the response. */
  MaxResults?: number | null;
}

// refs: 1 - tags: named, input
/**  */
export interface PurgeQueueRequest {
  /** The URL of the queue from which the `PurgeQueue` action deletes messages. */
  QueueUrl: string;
}

// refs: 1 - tags: named, input
/**  */
export interface ReceiveMessageRequest {
  /** The URL of the Amazon SQS queue from which messages are received. */
  QueueUrl: string;
  /** ! IMPORTANT: */
  AttributeNames?: MessageSystemAttributeName[] | null;
  /** A list of attributes that need to be returned along with each message. */
  MessageSystemAttributeNames?: MessageSystemAttributeName[] | null;
  /** The name of the message attribute, where _N_ is the index. */
  MessageAttributeNames?: string[] | null;
  /** The maximum number of messages to return. */
  MaxNumberOfMessages?: number | null;
  /** The duration (in seconds) that the received messages are hidden from subsequent retrieve requests after being retrieved by a `ReceiveMessage` request. */
  VisibilityTimeout?: number | null;
  /** The duration (in seconds) for which the call waits for a message to arrive in the queue before returning. */
  WaitTimeSeconds?: number | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  ReceiveRequestAttemptId?: string | null;
}

// refs: 1 - tags: named, input
/**  */
export interface RemovePermissionRequest {
  /** The URL of the Amazon SQS queue from which permissions are removed. */
  QueueUrl: string;
  /** The identification of the permission to remove. */
  Label: string;
}

// refs: 1 - tags: named, input
/**  */
export interface SendMessageRequest {
  /** The URL of the Amazon SQS queue to which a message is sent. */
  QueueUrl: string;
  /** The message to send. */
  MessageBody: string;
  /** The length of time, in seconds, for which to delay a specific message. */
  DelaySeconds?: number | null;
  /** Each message attribute consists of a `Name`, `Type`, and `Value`. */
  MessageAttributes?: { [key: string]: MessageAttributeValue | null | undefined } | null;
  /** The message system attribute to send. */
  MessageSystemAttributes?: { [key in MessageSystemAttributeNameForSends]: MessageSystemAttributeValue | null | undefined } | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  MessageDeduplicationId?: string | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  MessageGroupId?: string | null;
}

// refs: 1 - tags: named, input
/**  */
export interface SendMessageBatchRequest {
  /** The URL of the Amazon SQS queue to which batched messages are sent. */
  QueueUrl: string;
  /** A list of `"SendMessageBatchRequestEntry"` items. */
  Entries: SendMessageBatchRequestEntry[];
}

// refs: 1 - tags: named, input
/**  */
export interface SetQueueAttributesRequest {
  /** The URL of the Amazon SQS queue whose attributes are set. */
  QueueUrl: string;
  /** A map of attributes to set. */
  Attributes: { [key in QueueAttributeName]: string | null | undefined };
}

// refs: 1 - tags: named, input
export interface StartMessageMoveTaskRequest {
  /** The ARN of the queue that contains the messages to be moved to another queue. */
  SourceArn: string;
  /** The ARN of the queue that receives the moved messages. */
  DestinationArn?: string | null;
  /** The number of messages to be moved per second (the message movement rate). */
  MaxNumberOfMessagesPerSecond?: number | null;
}

// refs: 1 - tags: named, input
export interface TagQueueRequest {
  /** The URL of the queue. */
  QueueUrl: string;
  /** The list of tags to be added to the specified queue. */
  Tags: { [key: string]: string | null | undefined };
}

// refs: 1 - tags: named, input
export interface UntagQueueRequest {
  /** The URL of the queue. */
  QueueUrl: string;
  /** The list of tags to be removed from the specified queue. */
  TagKeys: string[];
}

// refs: 1 - tags: named, output
export interface CancelMessageMoveTaskResult {
  /** The approximate number of messages already moved to the destination queue. */
  ApproximateNumberOfMessagesMoved?: number | null;
}

// refs: 1 - tags: named, output
/** For each message in the batch, the response contains a `"ChangeMessageVisibilityBatchResultEntry"` tag if the message succeeds or a `"BatchResultErrorEntry"` tag if the message fails. */
export interface ChangeMessageVisibilityBatchResult {
  /** A list of `"ChangeMessageVisibilityBatchResultEntry"` items. */
  Successful: ChangeMessageVisibilityBatchResultEntry[];
  /** A list of `"BatchResultErrorEntry"` items. */
  Failed: BatchResultErrorEntry[];
}

// refs: 1 - tags: named, output
/** Returns the `QueueUrl` attribute of the created queue. */
export interface CreateQueueResult {
  /** The URL of the created Amazon SQS queue. */
  QueueUrl?: string | null;
}

// refs: 1 - tags: named, output
/** For each message in the batch, the response contains a `"DeleteMessageBatchResultEntry"` tag if the message is deleted or a `"BatchResultErrorEntry"` tag if the message can't be deleted. */
export interface DeleteMessageBatchResult {
  /** A list of `"DeleteMessageBatchResultEntry"` items. */
  Successful: DeleteMessageBatchResultEntry[];
  /** A list of `"BatchResultErrorEntry"` items. */
  Failed: BatchResultErrorEntry[];
}

// refs: 1 - tags: named, output
/** A list of returned queue attributes. */
export interface GetQueueAttributesResult {
  /** A map of attributes to their respective values. */
  Attributes?: { [key in QueueAttributeName]: string | null | undefined } | null;
}

// refs: 1 - tags: named, output
/** For more information, see [Interpreting Responses](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-api-responses.html) in the _Amazon SQS Developer Guide_. */
export interface GetQueueUrlResult {
  /** The URL of the queue. */
  QueueUrl?: string | null;
}

// refs: 1 - tags: named, output
/** A list of your dead letter source queues. */
export interface ListDeadLetterSourceQueuesResult {
  /** A list of source queue URLs that have the `RedrivePolicy` queue attribute configured with a dead-letter queue. */
  queueUrls: string[];
  /** Pagination token to include in the next request. */
  NextToken?: string | null;
}

// refs: 1 - tags: named, output
export interface ListMessageMoveTasksResult {
  /** A list of message movement tasks and their attributes. */
  Results?: ListMessageMoveTasksResultEntry[] | null;
}

// refs: 1 - tags: named, output
export interface ListQueueTagsResult {
  /** The list of all tags added to the specified queue. */
  Tags?: { [key: string]: string | null | undefined } | null;
}

// refs: 1 - tags: named, output
/** A list of your queues. */
export interface ListQueuesResult {
  /** A list of queue URLs, up to 1,000 entries, or the value of `MaxResults` that you sent in the request. */
  QueueUrls?: string[] | null;
  /** Pagination token to include in the next request. */
  NextToken?: string | null;
}

// refs: 1 - tags: named, output
/** A list of received messages. */
export interface ReceiveMessageResult {
  /** A list of messages. */
  Messages?: Message[] | null;
}

// refs: 1 - tags: named, output
/** The `MD5OfMessageBody` and `MessageId` elements. */
export interface SendMessageResult {
  /** An MD5 digest of the non-URL-encoded message body string. */
  MD5OfMessageBody?: string | null;
  /** An MD5 digest of the non-URL-encoded message attribute string. */
  MD5OfMessageAttributes?: string | null;
  /** An MD5 digest of the non-URL-encoded message system attribute string. */
  MD5OfMessageSystemAttributes?: string | null;
  /** An attribute containing the `MessageId` of the message sent to the queue. */
  MessageId?: string | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  SequenceNumber?: string | null;
}

// refs: 1 - tags: named, output
/** For each message in the batch, the response contains a `"SendMessageBatchResultEntry"` tag if the message succeeds or a `"BatchResultErrorEntry"` tag if the message fails. */
export interface SendMessageBatchResult {
  /** A list of `"SendMessageBatchResultEntry"` items. */
  Successful: SendMessageBatchResultEntry[];
  /** A list of `"BatchResultErrorEntry"` items with error details about each message that can't be enqueued. */
  Failed: BatchResultErrorEntry[];
}

// refs: 1 - tags: named, output
export interface StartMessageMoveTaskResult {
  /** An identifier associated with a message movement task. */
  TaskHandle?: string | null;
}

// refs: 1 - tags: input, named, interface
/** Encloses a receipt handle and an entry ID for each message in `"ChangeMessageVisibilityBatch".` */
export interface ChangeMessageVisibilityBatchRequestEntry {
  /** An identifier for this particular receipt handle used to communicate the result. */
  Id: string;
  /** A receipt handle. */
  ReceiptHandle: string;
  /** The new value (in seconds) for the message's visibility timeout. */
  VisibilityTimeout?: number | null;
}

// refs: 4 - tags: input, named, enum, output
export type QueueAttributeName =
| "All"
| "Policy"
| "VisibilityTimeout"
| "MaximumMessageSize"
| "MessageRetentionPeriod"
| "ApproximateNumberOfMessages"
| "ApproximateNumberOfMessagesNotVisible"
| "CreatedTimestamp"
| "LastModifiedTimestamp"
| "QueueArn"
| "ApproximateNumberOfMessagesDelayed"
| "DelaySeconds"
| "ReceiveMessageWaitTimeSeconds"
| "RedrivePolicy"
| "FifoQueue"
| "ContentBasedDeduplication"
| "KmsMasterKeyId"
| "KmsDataKeyReusePeriodSeconds"
| "DeduplicationScope"
| "FifoThroughputLimit"
| "RedriveAllowPolicy"
| "SqsManagedSseEnabled"

// refs: 1 - tags: input, named, interface
/** Encloses a receipt handle and an identifier for it. */
export interface DeleteMessageBatchRequestEntry {
  /** The identifier for this particular receipt handle. */
  Id: string;
  /** A receipt handle. */
  ReceiptHandle: string;
}

// refs: 3 - tags: input, named, enum, output
export type MessageSystemAttributeName =
| "All"
| "SenderId"
| "SentTimestamp"
| "ApproximateReceiveCount"
| "ApproximateFirstReceiveTimestamp"
| "SequenceNumber"
| "MessageDeduplicationId"
| "MessageGroupId"
| "AWSTraceHeader"
| "DeadLetterQueueSourceArn";

// refs: 3 - tags: input, named, interface, output
/** The user-specified message attribute value. */
export interface MessageAttributeValue {
  /** Strings are Unicode with UTF-8 binary encoding. */
  StringValue?: string | null;
  /** Binary type attributes can store any binary data, such as compressed data, encrypted data, or images. */
  BinaryValue?: Uint8Array | string | null;
  /** Not implemented. */
  StringListValues?: string[] | null;
  /** Not implemented. */
  BinaryListValues?: (Uint8Array | string)[] | null;
  /** Amazon SQS supports the following logical data types: `String`, `Number`, and `Binary`. */
  DataType: string;
}

// refs: 2 - tags: input, named, enum
export type MessageSystemAttributeNameForSends =
| "AWSTraceHeader";

// refs: 2 - tags: input, named, interface
/** The user-specified message system attribute value. */
export interface MessageSystemAttributeValue {
  /** Strings are Unicode with UTF-8 binary encoding. */
  StringValue?: string | null;
  /** Binary type attributes can store any binary data, such as compressed data, encrypted data, or images. */
  BinaryValue?: Uint8Array | string | null;
  /** Not implemented. */
  StringListValues?: string[] | null;
  /** Not implemented. */
  BinaryListValues?: (Uint8Array | string)[] | null;
  /** Amazon SQS supports the following logical data types: `String`, `Number`, and `Binary`. */
  DataType: string;
}

// refs: 1 - tags: input, named, interface
/** Contains the details of a single Amazon SQS message along with an `Id`. */
export interface SendMessageBatchRequestEntry {
  /** An identifier for a message in this batch used to communicate the result. */
  Id: string;
  /** The body of the message. */
  MessageBody: string;
  /** The length of time, in seconds, for which a specific message is delayed. */
  DelaySeconds?: number | null;
  /** Each message attribute consists of a `Name`, `Type`, and `Value`. */
  MessageAttributes?: { [key: string]: MessageAttributeValue | null | undefined } | null;
  /** The message system attribute to send Each message system attribute consists of a `Name`, `Type`, and `Value`. */
  MessageSystemAttributes?: { [key in MessageSystemAttributeNameForSends]: MessageSystemAttributeValue | null | undefined } | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  MessageDeduplicationId?: string | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  MessageGroupId?: string | null;
}

// refs: 1 - tags: output, named, interface
/** Encloses the `Id` of an entry in `"ChangeMessageVisibilityBatch".` */
export interface ChangeMessageVisibilityBatchResultEntry {
  /** Represents a message whose visibility timeout has been changed successfully. */
  Id: string;
}

// refs: 3 - tags: output, named, interface
/** Gives a detailed description of the result of an action on each entry in the request. */
export interface BatchResultErrorEntry {
  /** The `Id` of an entry in a batch request. */
  Id: string;
  /** Specifies whether the error happened due to the caller of the batch API action. */
  SenderFault: boolean;
  /** An error code representing why the action failed on this entry. */
  Code: string;
  /** A message explaining why the action failed on this entry. */
  Message?: string | null;
}

// refs: 1 - tags: output, named, interface
/** Encloses the `Id` of an entry in `"DeleteMessageBatch".` */
export interface DeleteMessageBatchResultEntry {
  /** Represents a successfully deleted message. */
  Id: string;
}

// refs: 1 - tags: output, named, interface
/** Contains the details of a message movement task. */
export interface ListMessageMoveTasksResultEntry {
  /** An identifier associated with a message movement task. */
  TaskHandle?: string | null;
  /** The status of the message movement task. */
  Status?: string | null;
  /** The ARN of the queue that contains the messages to be moved to another queue. */
  SourceArn?: string | null;
  /** The ARN of the destination queue if it has been specified in the `StartMessageMoveTask` request. */
  DestinationArn?: string | null;
  /** The number of messages to be moved per second (the message movement rate), if it has been specified in the `StartMessageMoveTask` request. */
  MaxNumberOfMessagesPerSecond?: number | null;
  /** The approximate number of messages already moved to the destination queue. */
  ApproximateNumberOfMessagesMoved?: number | null;
  /** The number of messages to be moved from the source queue. */
  ApproximateNumberOfMessagesToMove?: number | null;
  /** The task failure reason (only included if the task status is FAILED). */
  FailureReason?: string | null;
  /** The timestamp of starting the message movement task. */
  StartedTimestamp?: number | null;
}

// refs: 1 - tags: output, named, interface
/** An Amazon SQS message. */
export interface Message {
  /** A unique identifier for the message. */
  MessageId?: string | null;
  /** An identifier associated with the act of receiving the message. */
  ReceiptHandle?: string | null;
  /** An MD5 digest of the non-URL-encoded message body string. */
  MD5OfBody?: string | null;
  /** The message's contents (not URL-encoded). */
  Body?: string | null;
  /** A map of the attributes requested in `"ReceiveMessage"` to their respective values. */
  Attributes?: { [key in MessageSystemAttributeName]: string | null | undefined } | null;
  /** An MD5 digest of the non-URL-encoded message attribute string. */
  MD5OfMessageAttributes?: string | null;
  /** Each message attribute consists of a `Name`, `Type`, and `Value`. */
  MessageAttributes?: { [key: string]: MessageAttributeValue | null | undefined } | null;
}

// refs: 1 - tags: output, named, interface
/** Encloses a `MessageId` for a successfully-enqueued message in a `"SendMessageBatch".` */
export interface SendMessageBatchResultEntry {
  /** An identifier for the message in this batch. */
  Id: string;
  /** An identifier for the message. */
  MessageId: string;
  /** An MD5 digest of the non-URL-encoded message body string. */
  MD5OfMessageBody: string;
  /** An MD5 digest of the non-URL-encoded message attribute string. */
  MD5OfMessageAttributes?: string | null;
  /** An MD5 digest of the non-URL-encoded message system attribute string. */
  MD5OfMessageSystemAttributes?: string | null;
  /** This parameter applies only to FIFO (first-in-first-out) queues. */
  SequenceNumber?: string | null;
}
