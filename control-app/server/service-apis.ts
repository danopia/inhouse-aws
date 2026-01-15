import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';

import { handleStsAction } from './services/sts';
import { handleSnsAction } from './services/sns';
import { handleSqsJsonAction } from './services/sqs-json';
import { handleSqsQueryAction } from './services/sqs-query';
import { check } from 'meteor/check';

WebApp.connectHandlers.use('/', async (req, res, next) => {
  if (req.method !== 'POST') {

    // TODO: s3
    if (req.url == '/s3-bucket/s3-object') {
      res.setHeader('content-type', 'application/json');
      res.writeHead(200);
      res.end(`{}`);
      return;
    }

    if (req.url == '/healthz') return next();
    if (req.url == '/readyz') return next();

    console.log(req.method, req.url);

    if (!req.headers['authorization']?.startsWith('AWS4-HMAC-')) {
      return next();
    }
  }

  function sendXml(status: number, text: string) {
    res.setHeader('content-type', 'application/xml');
    res.writeHead(status);
    res.end(text);
  }
  function sendJson(status: number, text: string) {
    res.setHeader('content-type', 'application/json');
    res.writeHead(status);
    res.end(text);
  }

  try {

    const data = new Array<string>();
    req.setEncoding('utf-8');
    req.on('data', x => data.push(x));
    await new Promise(ok => req.on('end', ok));
    const reqBody = data.join('');

    const reqAuth = new Map(req.headers['authorization']?.slice('AWS4-HMAC-SHA256 '.length).split(', ').map(x => x.split('=') as [string,string]));
    const [accessKeyId, sigDate, region, signingService, sigVersion] = reqAuth.get('Credential')?.split('/') ?? [];

    const accountId = '123456123456';

    const jsonTarget = req.headers['x-amz-target'];
    if (typeof jsonTarget == 'string' && jsonTarget.includes('.') && req.headers['content-type'] == 'application/x-amz-json-1.0') {
      const [serviceName, action] = jsonTarget.split('.');

      logRequest(accessKeyId, serviceName, action, req.headers, reqBody);
      switch (serviceName) {

        case 'AmazonSQS':
          return sendJson(200, await handleSqsJsonAction(action, reqBody, accountId, region));

        default: throw new Meteor.Error(`Unimplemented`,
          `JSON service ${serviceName} action ${action} is not available`);
      }
    }

    if (req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
      const reqParams = new URLSearchParams(reqBody);
      const action = reqParams.get('Action');
      check(action, String);

      let service = signingService;
      if (action?.startsWith('AssumeRoleWith')) {
        service = 'sts';
      }

      logRequest(accessKeyId, service, action, req.headers, reqBody);
      switch (service) {

        case 'sts':
          return sendXml(200, await handleStsAction(reqParams, accountId, region));

        case 'sns':
          return sendXml(200, await handleSnsAction(reqParams, accountId, region));

        case 'sqs':
          return sendXml(200, await handleSqsQueryAction(reqParams, accountId, region));

        default: throw new Meteor.Error(`Unimplemented`,
          `Query service ${service} action ${action} is not available`);
      }
    }

    console.log('not found', req.headers)
    return sendJson(404, "not found");

  } catch (err) {
    if (err instanceof Meteor.Error) {
      console.log('Returning error:', err.message);
      sendXml(400, `<ErrorResponse><Error><Type>Sender</Type><Code>${err.error}</Code><Message>${err.reason}</Message></Error></ErrorResponse>`);
    } else {
      const genErr = err as Error;
      console.log('Uncaught error:', genErr.message);
      sendXml(400, `<ErrorResponse><Error><Type>Sender</Type><Code>ServerError</Code><Message>${genErr.message}</Message></Error></ErrorResponse>`);
    }
  }

});

function logRequest(accessKeyId: string, service: string, action: string, headers: Record<string,string|string[]|undefined>, body: string) {

  if (action == 'ReceiveMessage') return;

  console.log(`${accessKeyId} called ${service} API`, action);

  // console.log({ headers, body });
}
