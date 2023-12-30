// @ts-check
import { JSDOM } from "jsdom";
import { promises as fs } from "fs";
import { doc } from "prettier";

const textageFiles = [
  "titletbl",
  "actbl",
  "cstbl",
  "cstbl1",
  "cstbl2",
  "cltbl",
  "stepup",
  "datatbl",
  "scrlist"
];
const textageDir = "scripts/scraping/textage"

async function exists(f) {
  try {
    await fs.stat(f);
    return true;
  } catch {
    return false;
  }
}

export async function textageDL(force = false) {
  const textageScrapeReady = textageFiles.every((fn) => exists(`${textageDir}/${fn}.js`));
  if (force || !textageScrapeReady) {
    console.log("Redownloading source JS from textage...")
    // Clear out the existing textage JS, if it exists.
    if (exists(textageDir)) {
      await fs.rm(textageDir, {"recursive": true, "force": true})
    }
    // Redownload all the necessary textage JS.
    await fs.mkdir(textageDir)

    let dom = new JSDOM('<!DOCTYPE html>');
    let document = dom.window.document;
    for (let fn of textageFiles) {
      await fetch(`https://textage.cc/score/${fn}.js`)
        .then(response => response.blob())
        .then(blob => {
          console.log(`Downloading ${fn}...`)
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${textageDir}/${fn}.js`;
          link.click();
          // TODO: This doesn't work because JSDOM doesn't do navigation,
          // which includes resolving this link as a download.
        })
        .catch(error => console.error('Failed to download textage JS source:', error))
    }

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

export async function fakeTextage() {
  // https://stackoverflow.com/questions/950087/how-do-i-include-a-javascript-file-in-another-javascript-file

  // actbl from titletbl.js contains the full map of song tags to their genre, artist, and title for each.
  // e_list[2] from titletbl.js contains a list of active unlock events and the associated song tags.
  // get_level(tag, type, num) from scrlist.js has the logic to look up charts by slot.
  const chartSlot = ["inclusion", "SPB", "SPN", "SPH", "SPA", "SPL", "DPB", "DPN", "DPH", "DPA", "DPL"];
   
  var dom = new JSDOM('<!DOCTYPE html><head><meta charset="UTF-8"><script type="text/javascript">var location = {"search": "?a001B000"};</script></head>', {runScripts: "dangerously", resources: "usable"});
  dom.window.location.search = "?a001B000"
  var document = dom.window.document;

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

  return dom;
}
