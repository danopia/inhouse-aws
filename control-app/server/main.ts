import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { QueuesCollection } from '/imports/db/queues';
import { TopicsCollection } from '/imports/db/topics';

import './service-apis';
import { QueueMessagesCollection } from '/imports/db/queue-messages';

Meteor.publish(null, () => [
  TopicsCollection.find(),
  QueuesCollection.find(),
  QueueMessagesCollection.find({}, {sort: {modifiedAt: -1}, limit: 50}),
])

Meteor.publish('/queues/by-id/messages/recent', (queueId: unknown) => {
  check(queueId, String);
  return [
    QueuesCollection.find({ _id: queueId }),
    QueueMessagesCollection.find({ queueId }, {sort: {createdAt: -1}, limit: 50}),
  ];
});
