/*jslint node*/
const {transform} = require("lightningcss");
const {readFile} = require("node:fs");
const {promisify} = require("node:util");
const path = require("node:path");
const fileReader = promisify(readFile);

async function parseCss({dir}, src) {
    const blob = await fileReader(path.normalize(
        `${dir.input}/${dir.includes}/${src}`
    ));
    const {code} = transform({
        code: blob,
        filename: "style.css",
        minify: true
    });
    return code.toString();
}
module.exports = function (config) {
    config.addPassthroughCopy("assets");
    config.addShortcode("cssmin", function (src) {
        return parseCss(config, src);
    });
    return {
        dir: {
            includes: "_templates",
            input: "src",
            output: "_site"
        }
    };
};
