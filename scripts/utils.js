const fs = require("fs");
const prettier = require("prettier");

function writeJsonData(data, filePath) {
  fs.writeFileSync(
    filePath,
    prettier.format(JSON.stringify(data), { filepath: filePath })
  );
}

module.exports = {
  writeJsonData,
};
