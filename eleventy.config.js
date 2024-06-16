/*jslint node*/
module.exports = function (config) {
    config.addPassthroughCopy("assets");
    return {
        dir: {
            includes: "_templates",
            input: "src",
            output: "_site"
        }
    };
};
