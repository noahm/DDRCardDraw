// @ts-check
import { JSDOM } from "jsdom";
import iconv from "iconv-lite"
import { Axios } from "axios";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const textageFiles = [
  "titletbl",
  "actbl",
//"cstbl",
//"cstbl1",
//"cstbl2",
//"cltbl",
//"stepup",
  "datatbl",
  "scrlist"
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const textageDir = path.join(__dirname, "textage")
console.log(textageDir)

async function exists(f) {
  try {
    await fs.promises.stat(f);
    return true;
  } catch {
    return false;
  }
}

export async function textageDL(force = false) {
  const textageScrapeReady = await Promise.all(textageFiles.map((fn) => exists(`${textageDir}/${fn}.js`))).then((a) => a.every((v) => (v)));
  if (force || !textageScrapeReady) {
    console.log("Redownloading source JS from textage...")
    // Clear out the existing textage JS, if it exists.
    if (exists(textageDir)) {
      await fs.promises.rm(textageDir, {"recursive": true, "force": true})
    }
    // Redownload all the necessary textage JS.
    await fs.promises.mkdir(textageDir).catch(()=>{})
    
    for (let fn of textageFiles) {
      if (await exists(`${textageDir}/${fn}.js`)) {
        console.log(`Don't need to redownload ${fn}`)
        continue;
      }
      console.log(`Downloading ${fn}...`)
      
      let req = new Axios({
        method: 'get',
        url: `https://textage.cc/score/${fn}.js`,
        responseType: 'stream'
      })
      await req.get(`https://textage.cc/score/${fn}.js`).then(function (response) {
        const writer = fs.createWriteStream(path.join(textageDir, `${fn}.js`))
        response.data.pipe(iconv.decodeStream("shift-jis"))
                     .pipe(iconv.encodeStream("utf-8"))
                     .pipe(writer)
        return new Promise((resolve, reject) => {
          writer.on('error', reject);
          response.data.on('end', resolve)
        })
      });
      //.catch(error => console.error('Failed to download textage JS source:', error))
    }

    // Force all-AC listing.
    /*
    await fs.promises.readFile(path.join(textageDir, `scrlist.js`), {encoding: "utf-8"}).then((data) => {
      var updatedJS = data.replaceAll(`location.search`, `"?a001B000"`);
      var updatedJS = data.replaceAll(`"?vV11B000"`, `"?a001B000"`);
      return fs.promises.writeFile(path.join(textageDir, `scrlist.js`), updatedJS, {encoding: "utf-8"})
    })
    */

    // Double-check that we got all of the textage JS.
    const textageScrapeSuccess = textageFiles.every((fn) => exists(`scraping/textage/${fn}.js`));
    if (!textageScrapeSuccess) {
      console.log(
        `Failed to download textage JS sources. Invoke like 'yarn import:iidx [rescrape]'`,
      );
    }
    return textageScrapeSuccess;
  }
  else {
    console.log("Not redownloading source JS from textage")
    return textageScrapeReady;
  }
}

export async function fakeTextage(force = false) {
  // https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

  // actbl from titletbl.js contains the full map of song tags to their genre, artist, and title for each.
  // e_list[2] from titletbl.js contains a list of active unlock events and the associated song tags.
  // get_level(tag, type, num) from scrlist.js has the logic to look up charts by slot.
  const chartSlot = ["inclusion", "SPB", "SPN", "SPH", "SPA", "SPL", "DPB", "DPN", "DPH", "DPA", "DPL"];
   
  var dom = new JSDOM('<!DOCTYPE html><head><meta charset="UTF-8"></head>', {runScripts: "dangerously", resources: "usable"});
  var document = dom.window.document;

  await textageDL(force);

  for (let fn of textageFiles) {
    let fnLoader = function(doc) {return new Promise(function(resolve) {
      let script = doc.createElement("script");
      script.type = "text/javascript";
      //script.charset = "UTF-8";
      script.src = `https://textage.cc/score/${fn}.js`;
      script.async = false;
      script.onload = function() {resolve(doc);};

      doc.head.appendChild(script);
    }) };
    await fnLoader(document).then((doc) => {document = doc});
    console.log(`${fn} loaded`)
  }

  // Make sure the reconstructed textage is preloaded with the AC listing.
  dom.window.eval("lc = ['?', 'a', 0, 0, 1, 11, 0, 0, 0];")
  dom.window.eval("disp_all();")

  // Test cases (Abyss -The Heavens Remix-, AIR RAID FROM THA UNDAGROUND)
  // console.log(textageDOM.window.eval(`Array.from(Array(11).entries()).map((v) => get_level("abyss_r", v[0], 1))`))
  // console.log(textageDOM.window.eval(`Array.from(Array(11).entries()).map((v) => get_level("airraid", v[0], 1))`))

  return dom;
}
