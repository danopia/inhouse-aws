#!/usr/bin/env -S deno run --allow-env --allow-net --watch
import { handleStsAction } from './sts/api-query.ts';
import { handleSnsAction } from './sns/api-query.ts';
import { handleSqsJsonAction } from './sqs/api-json.ts';
import { handleSqsQueryAction } from './sqs/api-query.ts';
import { random, ReqCtx, ServiceError } from "./shared.ts";
import { RecordsCollection } from "./cloudtrail/db-records.ts";

Deno.serve({
  hostname: '::',
}, async (req, connInfo) => {
  if (req.method !== 'POST') {

    // TODO: s3
    if (req.url == '/s3-bucket/s3-object') {
      return Response.json({});
    }

    if (req.url == '/healthz') return Response.json('ok');
    if (req.url == '/readyz') return Response.json('ok');

    console.log(req.method, req.url);

    if (!req.headers.get('authorization')?.startsWith('AWS4-HMAC-')) {
      return new Response('404', { status: 404 });
    }
  }

  function sendXml(status: number, text: string) {
    return new Response(text, {
      headers: { 'content-type': 'application/xml' },
      status,
    });
  }
  function sendJson(status: number, text: string) {
    return new Response(text, {
      headers: { 'content-type': 'application/json' },
      status,
    });
  }

  try {

    const data = new Uint8Array(await req.arrayBuffer());
    const reqBody = new TextDecoder().decode(data);

    const reqAuth = new Map(req.headers.get('authorization')?.slice('AWS4-HMAC-SHA256 '.length).split(', ').map(x => x.split('=') as [string,string]));
    const [accessKeyId, sigDate, region, signingService, sigVersion] = reqAuth.get('Credential')?.split('/') ?? [];

    const ctx: ReqCtx = {
      req, connInfo,
      region: region,
      auth: {
        accountId: '123456123456',
        accessKeyId,
      },
      requestId: crypto.randomUUID(),
    };


    const jsonTarget = req.headers.get('x-amz-target');
    if (typeof jsonTarget == 'string' && jsonTarget.includes('.') && req.headers.get('content-type') == 'application/x-amz-json-1.0') {
      const [serviceName, action] = jsonTarget.split('.');

      logRequest(ctx, serviceName, action);
      switch (serviceName) {

        case 'AmazonSQS':
          return sendJson(200, await handleSqsJsonAction(ctx, action, reqBody));

        default: throw new ServiceError(`Unimplemented`,
          `JSON service ${serviceName} action ${action} is not available`);
      }
    }

    if (req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
      const reqParams = new URLSearchParams(reqBody);
      const action = reqParams.get('Action');
      // check(action, String);

      let service = signingService;
      if (action?.startsWith('AssumeRoleWith')) {
        service = 'sts';
      }

      logRequest(ctx, service, `${action}`);
      switch (service) {

        case 'sts':
          return sendXml(200, await handleStsAction(ctx, reqParams));

        case 'sns':
          return sendXml(200, await handleSnsAction(ctx, reqParams));

        case 'sqs':
          return sendXml(200, await handleSqsQueryAction(ctx, reqParams));

        default: throw new ServiceError(`Unimplemented`,
          `Query service ${service} action ${action} is not available`);
      }
    }

    console.log('not found', req.headers)
    return sendJson(404, "not found");

  } catch (err) {
    if (err instanceof ServiceError) {
      console.log('Returning error:', err.message);
      return sendXml(400, `<ErrorResponse><Error><Type>Sender</Type><Code>${err.error}</Code><Message>${err.reason}</Message></Error></ErrorResponse>`);
    } else {
      const genErr = err as Error;
      console.log('Uncaught error:', genErr.message);
      return sendXml(400, `<ErrorResponse><Error><Type>Sender</Type><Code>ServerError</Code><Message>${genErr.message}</Message></Error></ErrorResponse>`);
    }
  }

});

async function logRequest(ctx: ReqCtx, service: string, action: string) {

  if (action == 'ReceiveMessage') return;

  await RecordsCollection.insertOne({
    _id: random.id(),
    awsRegion: ctx.region,
    eventCategory: 'Management',
    eventID: crypto.randomUUID(),
    eventName: 'CreateQueue',
    eventSource: 'sqs.amazonaws.com',
    eventTime: new Date().toISOString(),
    eventType: 'AwsApiCall',
    eventVersion: '1.08',
    recipientAccountId: ctx.destAccountId,
    requestID: ctx.requestId,
    sourceIPAddress: ctx.connInfo.remoteAddr.hostname,
    userAgent: ctx.req.headers.get('user-agent') ?? 'Unknown',
    userIdentity: ctx.auth ? {
      type: 'IAMUser',
      accessKeyId: ctx.auth.accessKeyId,
      accountId: ctx.auth.accountId,
      // TODO
      "principalId": "EXAMPLE6E4XEGITWATV6R",
      "arn": "arn:aws:iam::123456789012:user/Mateo",
      "userName": "Mateo",
      sessionContext: {},
    } : null as any,
    requestParameters: {},
    responseElements: null,
    managementEvent: false,
    readOnly: false,
  });

  console.log(`${ctx.auth.accessKeyId} called ${service} API`, action);

  // console.log({ headers, body });
}
