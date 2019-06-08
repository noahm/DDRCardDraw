const validateJSONSchema = require('jsonschema').validate;

const songsSchema = require('../songs.schema.json');

const dataFiles = [
  'ace.json',
  'extreme.json',
  'a20.json'
];

const hasError = false;
for (const dataFile of dataFiles) {
  const songData = require(`../src/songs/${dataFile}`);
  const result = validateJSONSchema(songData, songsSchema, {
    nestedErrors: true,
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
  require('process').exit(1);
}
