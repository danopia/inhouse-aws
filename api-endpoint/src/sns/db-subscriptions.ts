import { mongoDb } from "../shared.ts";

export interface TopicSubscription {
  _id: string;
  accountId: string;
  topicId: string;
  createdAt: Date;
  modifiedAt: Date;
  endpoint: {
    protocol: 'sqs';
    queueId: string;
  };
  pendingConfirmation: boolean;
  confirmationWasAuthenticated: boolean;
  config: {
    // DeliveryPolicy?: string;
    // RedrivePolicy?: string;
    // FilterPolicy?: string;
    // FilterPolicyScope?: "MessageAttributes" | "MessageBody";
    RawMessageDelivery?: boolean;
    // SubscriptionRoleArn?: string;
  };
}

export const TopicSubscriptionsCollection = mongoDb.collection<TopicSubscription>('sns-TopicSubscriptions');
