#!/usr/bin/env -S deno run --watch --allow-net=[::]:8000,[::]:8443 --allow-env=WEBHOOK_TLS_DIRECTORY,INHOUSE_* --allow-read

import * as CoreV1 from '@cloudydeno/kubernetes-apis/core/v1';
import { AdmissionServer } from '@cloudydeno/kubernetes-admission';

const region = Deno.env.get(
  'INHOUSE_REGION'
) ?? 'us-east-1';
const destIp = Deno.env.get(
  Deno.env.get('INHOUSE_SERVICE_ENVVAR')
    ?? 'INHOUSE_CLOUD_SERVICE_HOST'
) ?? '127.0.0.1';

const srv = new AdmissionServer({
  name: 'inhouse-aws-webhook',
  repo: 'https://github.com/danopia/inhouse-aws',
}).withMutatingRule({
  operations: ['CREATE'],
  apiGroups: [''],
  apiVersions: ['v1'],
  resources: ['pods'],
  scope: 'Namespaced',
  callback(ctx) {
    const pod = CoreV1.toPod(ctx.request.object);

    ctx.log(`Adding inhouse-aws host aliases to ${pod.metadata?.namespace}/${pod.metadata?.name}`);

    // Add an empty list if there's none yet
    // (which will be the case probably almost always)
    if (!pod.spec?.hostAliases) {
      ctx.addPatch({
        op: 'add',
        path: '/spec/hostAliases',
        value: [],
      });
    }

    // Add an item to the list
    ctx.addPatch({
      op: 'add',
      path: '/spec/hostAliases/-',
      value: CoreV1.fromHostAlias({
        ip: destIp,
        hostnames: [
          `sqs.${region}.amazonaws.com`,
          `sns.${region}.amazonaws.com`,
          `sts.${region}.amazonaws.com`,
        ],
      }),
    });
  },
});

const tlsDirectory = Deno.env.get('WEBHOOK_TLS_DIRECTORY');
await Promise.race([
  srv.servePlaintext(),
  tlsDirectory
    ? srv.serveHttps(tlsDirectory)
    : false,
]);
