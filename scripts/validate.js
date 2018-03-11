const validateJSONSchema = require('jsonschema').validate;

const aceSongs = require('../ace.json');
const songsSchema = require('../songs.schema.json');
// validateJSONSchema(aceSongs, songsSchema, { throwError: true });
const result = validateJSONSchema(aceSongs, songsSchema, {
    nestedErrors: true,
});

if (result.valid) {
    console.log('ace.json looks good!');
} else {
    result.errors.forEach(error => {
        console.error(error.toString());
    });
    console.log('ace.json has issues!');
}
