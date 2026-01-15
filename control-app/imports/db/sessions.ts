import { Mongo } from 'meteor/mongo';

export interface Session {
  _id: string;
  createdAt: Date;
  expiresAt: Date;

  signingSecret: string;
  sessionToken: string;
  sessionName: string;

  accountId: string;
  roleArn: string;
  userArn: string;

  jwt?: {
    iss: string;
    sub: string;
  };
  kubernetes?: {
    namespace: string;
    podName?: string;
    saName: string;
  }

}

export const SessionsCollection = new Mongo.Collection<Session>('Sessions');
