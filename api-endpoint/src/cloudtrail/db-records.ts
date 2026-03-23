import { mongoDb } from "../shared.ts";

type CloudtrailRecord = {
  _id: string;
  // https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-record-contents.html
  "eventVersion": "1.08",
  "userIdentity": {
    "type": "IAMUser",
    "principalId": string; // "EXAMPLE6E4XEGITWATV6R",
    "arn": string; // "arn:aws:iam::123456789012:user/Mateo",
    "accountId"?: string; // "123456789012",
    "accessKeyId"?: string; // "AKIAIOSFODNN7EXAMPLE",
    "userName": string; // "Mateo",
    "sessionContext"?: {
      "sessionIssuer"?: {
        "type": "Root" | "IAMUser" | "Role";
        "userName"?: string;
        "principalId"?: string;
        "arn": string;
        "accountId": string;
      };
      "webIdFederationData"?: {
        "federatedProvider": string;
        "attributes": Record<string,string>;
      };
      "sourceIdentity"?: string;
      "attributes"?: {
        "creationDate"?: "2023-07-19T21:11:57Z",
        "mfaAuthenticated"?: "false"
      }
    }
  },
  "eventTime": string; // "2023-07-19T21:17:28Z"
  "eventSource": string; // "ec2.amazonaws.com"
  "eventName": string; // "StartInstances"
  "awsRegion": string;
  "sourceIPAddress": string;
  "userAgent": string;
  "requestParameters": Record<string,unknown>;
  "responseElements": Record<string,unknown> | null;
  "requestID"?: string; // uuid
  "eventID": string; // uuid
  "readOnly": boolean;
  "eventType": "AwsApiCall",
  "managementEvent": boolean;
  "recipientAccountId"?: string; // "123456789012",
  "eventCategory": "Management" | "Data" | "NetworkActivity",
  "tlsDetails"?: {
    "tlsVersion": string;
    "cipherSuite": string;
    "clientProvidedHostHeader": string;
  },
  // "sessionCredentialFromConsole": "true"
}

export const RecordsCollection = mongoDb.collection<CloudtrailRecord>('cloudtrail-Records');
