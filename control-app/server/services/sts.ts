import { Meteor } from "meteor/meteor";
import { SessionsCollection } from "/imports/db/sessions";
import { Random } from "meteor/random";
import { check } from "meteor/check";

export async function handleStsAction(reqParams: URLSearchParams, accountId: string, region: string) {
  switch (reqParams.get('Action')) {

  case 'GetCallerIdentity':
    return `<Result><GetCallerIdentityResult>
      <UserId>UserId</UserId>
      <Account>${accountId}</Account>
      <Arn>Arn</Arn>
    </GetCallerIdentityResult></Result>`;

  case 'AssumeRoleWithWebIdentity':
    const RoleArn = reqParams.get('RoleArn');
    check(RoleArn, String);
    const RoleSessionName = reqParams.get('RoleSessionName');
    const WebIdentityToken = reqParams.get('WebIdentityToken');
    check(WebIdentityToken, String);

    // throw new Meteor.Error(`TODO`, `TODO: parse OIDC JWT`);

    const oidcToken: {
      "exp": number;
      "iat": number;
      "nbf": number;
      "iss": string; // "https://container.googleapis.com/v1/projects/my-project/locations/europe-west1/clusters/my-gke"
      "aud": Array<string>;
      "sub": string; // "system:serviceaccount:my-namespace:my-sa"
      "kubernetes.io"?: {
        "namespace": string;
        "pod"?: {
          "name": string;
          "uid": string;
        };
        "serviceaccount": {
          "name": string;
          "uid": string;
        };
      };
    } = JSON.parse(Buffer.from(WebIdentityToken.split('.')[1], 'base64url').toString('utf-8'));

    if (oidcToken["kubernetes.io"]) {
      const kubeData = oidcToken["kubernetes.io"];
      console.log(`Received kubernetes OIDC token from ${kubeData.namespace}/${kubeData.pod?.name}`);
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.valueOf() + 15 * 60 * 1000);
      const accountId = '123456123456'; // TODO
      const signingSecret = Random.secret();
      const sessionToken = Random.secret();
      const userArn = `arn:aws:sts::${accountId}:assumed-role/${kubeData.namespace}/${kubeData.serviceaccount.name}`;
      const accessKeyId = await SessionsCollection.insertAsync({
        createdAt,
        expiresAt,
        accountId,
        roleArn: RoleArn,
        signingSecret,
        sessionToken,
        sessionName: RoleSessionName ?? 'none',
        userArn,
        jwt: {
          sub: oidcToken.sub,
          iss: oidcToken.iss,
        },
        kubernetes: {
          namespace: oidcToken['kubernetes.io'].namespace,
          podName: oidcToken['kubernetes.io'].pod?.name,
          saName: oidcToken['kubernetes.io'].serviceaccount?.name,
        },
      });
      return `<Result>
      <AssumeRoleWithWebIdentityResult>
        <SubjectFromWebIdentityToken>${oidcToken.sub}</SubjectFromWebIdentityToken>
        <Audience>${oidcToken.aud}</Audience>
        <AssumedRoleUser>
          <Arn>${userArn}</Arn>
          <AssumedRoleId>${kubeData.namespace}:${kubeData.serviceaccount.uid}</AssumedRoleId>
        </AssumedRoleUser>
        <Credentials>
          <AccessKeyId>${accessKeyId}</AccessKeyId>
          <SecretAccessKey>${signingSecret}</SecretAccessKey>
          <SessionToken>${sessionToken}</SessionToken>
          <Expiration>${expiresAt.toISOString()}</Expiration>
        </Credentials>
        <SourceIdentity>k8s/${kubeData.namespace}/${kubeData.serviceaccount.name}</SourceIdentity>
        <Provider>www.amazon.com</Provider>
      </AssumeRoleWithWebIdentityResult></Result>`;
    }
    throw new Meteor.Error(`InvalidIdentityToken`, `This is not a Kubernetes token!`);

  default:
    throw new Meteor.Error(`Unimplemented`, `Unimplemented`);
  }
}
