import { routePartykitRequest } from "partyserver";

export { Main } from "./server";

declare global {
  // augmenting the workers runtime's own global namespace, which partyserver
  // reads the env type from
  // oxlint-disable-next-line typescript/no-namespace
  namespace Cloudflare {
    interface Env {
      Main: DurableObjectNamespace<import("./server").Main>;
      /** off-box room snapshots, see `snapshot-store.ts` */
      SNAPSHOTS?: R2Bucket;
    }
  }
  type Env = Cloudflare.Env;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
