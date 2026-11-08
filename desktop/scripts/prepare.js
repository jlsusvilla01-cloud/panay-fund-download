// Copies vendor libraries and bundles ../index.html (the Panay Fund screens) into the renderer.
const fs = require("fs"), path = require("path");
const r = p => path.join(__dirname, "..", p);
fs.mkdirSync(r("renderer/vendor"), {recursive: true});
fs.copyFileSync(r("node_modules/@supabase/supabase-js/dist/umd/supabase.js"), r("renderer/vendor/supabase.js"));
fs.copyFileSync(r("node_modules/jspdf/dist/jspdf.umd.min.js"), r("renderer/vendor/jspdf.umd.min.js"));
fs.copyFileSync(r("node_modules/xlsx/dist/xlsx.full.min.js"), r("renderer/vendor/xlsx.full.min.js"));
const html = fs.readFileSync(r("../index.html"), "utf8");
const ver = (html.match(/APP_VERSION = "([\d.]+)"/) || [])[1] || require(r("package.json")).version;
fs.writeFileSync(r("renderer/app-bundle.js"), `window.PF_APP_VERSION = ${JSON.stringify(ver)};\nwindow.PF_APP_HTML = ${JSON.stringify(html)};\n`);
console.log("prepared app", ver);
