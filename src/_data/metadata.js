const fs = require("fs");
const path = require("path");

let __metaCache = null;
let __metaMtime = 0;

module.exports = function() {
  const staticMetadataPath = path.join(__dirname, "..", "static", "metadata.json");
  try {
    const stat = fs.statSync(staticMetadataPath);
    if (__metaCache && stat.mtimeMs === __metaMtime) {
      return __metaCache;
    }
    const raw = fs.readFileSync(staticMetadataPath, "utf-8");
    __metaCache = JSON.parse(raw);
    __metaMtime = stat.mtimeMs;
    return __metaCache;
  } catch (err) {
    console.warn("metadata.json not found or invalid at:", staticMetadataPath);
    __metaCache = {};
    __metaMtime = 0;
    return __metaCache;
  }
};

