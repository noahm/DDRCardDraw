const { readdirSync, writeFileSync } = require("fs");
const { resolve, join } = require("path");
const { validate: validateJSONSchema } = require("jsonschema");

const dataFileNames = readdirSync(resolve(join(__dirname, "../src/songs")));
const songsSchema = require("../songs.schema.json");
const schemaLocation = "src/models/SongData.ts";

let hasError = false;
for (const dataFile of dataFileNames) {
  const songData = require(`../src/songs/${dataFile}`);
  const result = validateJSONSchema(songData, songsSchema, {
    nestedErrors: true
  });

  if (result.valid) {
    console.log(`${dataFile} looks good!`);
  } else {
    result.errors.forEach(error => {
      console.error(error.toString());
    });
    console.log(`${dataFile} has issues!`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`Building schema file`);
const { compile } = require("json-schema-to-typescript");
compile(songsSchema, "SongData").then(ts => {
  writeFileSync(resolve(join(__dirname, "..", schemaLocation)), ts);
  console.log("Schema written to ", schemaLocation);
});
