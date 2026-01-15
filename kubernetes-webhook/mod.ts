import * as CoreV1 from "https://deno.land/x/kubernetes_apis@v0.3.1/builtin/core@v1/structs.ts";
import { AdmissionServer } from "https://deno.land/x/kubernetes_admission@v0.1.0/mod.ts";
import { watchFiles } from "https://deno.land/x/kubernetes_admission@v0.1.0/file-watcher.ts";

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

    ctx.log(`Adding inhouse-aws host alias to ${pod.metadata?.namespace}/${pod.metadata?.name}`);

    // Add an empty list if there's none yet
    // (which will be the case probably almost always)
    if (!pod.spec?.hostAliases) {
      ctx.addPatch({
        op: "add",
        path: "/spec/hostAliases",
        value: [],
      });
    }

    // Add an item to the list
    ctx.addPatch({
      op: "add",
      path: "/spec/hostAliases/-",
      value: CoreV1.fromHostAlias({
        ip: '10.4.43.152', // TODO: discover from cluster
        hostnames: [
          'sqs.eu-west-1.amazonaws.com',
          'sns.eu-west-1.amazonaws.com',
          'sts.eu-west-1.amazonaws.com',
        ],
      }),
    });
  },
});

srv.servePlaintext();

const tlsDirectory = Deno.env.get('WEBHOOK_TLS_DIRECTORY');
if (tlsDirectory) {
  const certFile = `${tlsDirectory || '.'}/tls.crt`;
  const keyFile = `${tlsDirectory || '.'}/tls.key`;
  for await (const signal of watchFiles([certFile, keyFile])) {
    console.log(`Serving @ https://[::]:${8443}/`);
    await Deno.serve({
      onError: srv.errorResponse.bind(srv),
      signal,
      port: 8443,
      hostname: '[::]',
      cert: await Deno.readTextFile(`${tlsDirectory || '.'}/tls.crt`),
      key: await Deno.readTextFile(`${tlsDirectory || '.'}/tls.key`),
    }, srv.handleRequest.bind(srv)).finished;
    console.log(`HTTPS listener has finished.`);
  }
}
