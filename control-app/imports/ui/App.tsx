import React from 'react';
import { QueueListPage } from './QueueListPage';
import { RecentQueueMessagesPage } from './RecentQueueMessagesPage';

export const App = () => (
  <div>
    <h1>In-House AWS - Control Plane</h1>
    <RecentQueueMessagesPage />
    <QueueListPage />
  </div>
);
