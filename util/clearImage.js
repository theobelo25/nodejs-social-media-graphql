const fs = require("fs");
const path = require("path");

const handleError = require("../util/handleError");

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    if (err) handleError(err);
  });
};

module.exports = clearImage;
