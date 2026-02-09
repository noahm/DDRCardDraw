/**
 * @file Injects a non-standard CA cert to resolve SSL issues hitting maimaidx.jp
 *
 * Sources:
 *  https://nodejs.org/en/learn/http/enterprise-network-configuration#configure-global-ca-certificates
 *  https://github.com/zetaraku/arcade-songs-fetch/commit/7eb94ca4912de6353a9b8a4660f23c965a305356
 **/

import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";

const currentCerts = tls.getCACertificates("default");
const globalsign2018 = fs.readFileSync(
  path.join(import.meta.dirname, "maimai", "gsrsaovsslca2018.pem"),
  "utf-8",
);
tls.setDefaultCACertificates([...currentCerts, globalsign2018]);
