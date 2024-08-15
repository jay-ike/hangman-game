/*jslint node*/
const i18n = require("eleventy-plugin-i18n");
const {transform} = require("lightningcss");
const {jsmin} = require("jsmin");
const {readFile, readdir, writeFile} = require("node:fs");
const {promisify} = require("node:util");
const path = require("node:path");
const fs = {};

fs.readFile = promisify(readFile);
fs.readDir = promisify(readdir);
fs.WriteFile = promisify(writeFile);

async function parseCss({dir}, src) {
    const blob = await fs.readFile(path.normalize(
        `${dir.input}/${dir.includes}/${src}`
    ));
    const {code} = transform({
        code: blob,
        filename: "style.css",
        minify: true
    });
    return code.toString();
}
function isMinifiable(file) {
    let notMinified = !file.name.match(/min.js$/);
    return file.isFile() && path.extname(file.name) === ".js" && notMinified;
}
async function minifyJs(file) {
    const path = `${file.path}/${file.name}`;
    let blob = await fs.readFile(path);
    blob = jsmin(blob.toString(), 3);
    await fs.WriteFile(path, blob)
}
async function minifyScripts(dir) {
    const jsDirs = [`${dir.output}/assets/scripts`, `${dir.output}`];
    let files = await Promise.all(jsDirs.map(
        (path) => fs.readDir(path, {withFileTypes: true})
    ));
    files = files.reduce(function (acc, list) {
        return acc.concat(list.filter(isMinifiable));
    }, []);
    await Promise.all(files.map(minifyJs));
}
module.exports = function (config) {
    config.addPassthroughCopy("assets");
    config.addPassthroughCopy("sw.js");
    config.addPassthroughCopy("sw-registration.js");
    config.addShortcode("cssmin", function (src) {
        return parseCss(config, src);
    });
    config.addPlugin(i18n, {
        translations: require("./src/_data/i18n"),
        fallbackLocales: {"fr": "en"}
    });
    config.on("eleventy.after", async function ({dir, runMode}) {
        if (runMode === "build") {
            await minifyScripts(dir);
        }
    });

    return {
        dir: {
            includes: "_templates",
            input: "src",
            output: "_site"
        }
    };
};
