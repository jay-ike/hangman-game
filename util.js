const Image = require("@11ty/eleventy-img");
const {readdir} = require("node:fs");
const {promisify} = require("node:util");
const path = require("node:path");
const fs = {};
const basename = (val) => path.basename(val, path.extname(val));

fs.readDir = promisify(readdir);

async function getFilePaths(workingDir, extensions= /(jpg|png|gif|jpeg)/i) {
    const files = await fs.readDir(workingDir, {withFileTypes: true});
    return files.filter(
        (entry) => entry.isFile() && path.extname(entry.name).match(extensions)
    ).map((entry) => path.normalize(entry.parentPath + "/" + entry.name));
}

function getSize(width) {
    return (
        width <= 375
        ? `(max-width: 30em) ${width}px`
        : `${width}px`
    );
}

function getAttributes(metadata, sizeGetter) {
    let result = Object.values(metadata).reduce(function (acc, val) {
        val.forEach(function (img) {
            const {format, height, width, srcset, url} = img;
            const size = sizeGetter(width);
            if (width <= acc.width) {
                acc.width = width;
                acc.height = height;
                if (format === "webp") {
                    acc.src = url;
                    acc.srcset.unshift(srcset);
                    acc.sizes.unshift(size);
                }
                if (format !== "webp" && acc.src) {
                    acc.srcset = [acc.srcset[0], srcset].concat(acc.srcset.slice(1));
                    acc.sizes = [acc.sizes[0], size].concat(acc.sizes.slice(1));
                }
            } else {
                acc.srcset.push(srcset);
                acc.sizes.push(size);
            }
        });
        return acc;
    }, {width: Number.MAX_SAFE_INTEGER, srcset: [], sizes: []});
    result.srcset = result.srcset.join(", ");
    result.sizes = result.sizes.join(", ");
    return result;
}

async function getBadgeMeta(src, props, sizes="192") {
    const metadata = await Image(src, {
        formats: ["webp", "auto"],
        outputDir: "./_site/assets/images/badges",
        urlPath: "/assets/images/badges/",
        widths: sizes.split(",").map((val) => parseInt(val, 10)).filter(
            (val) => Number.isFinite(val)
        )
    });
    let blob = await Image(src, {
        formats: "png",
        widths: [10],
        dryRun: true
    }).then((res) => res.png[0].buffer);
    const attributes = getAttributes(metadata, getSize);
    blob = blob.toString("base64");
    Object.assign(attributes,{decoding: "async", loading: "lazy"});
    attributes.style = "color: transparent;background: center/ 50% no-repeat " +
    "url(data:image/jpeg;base64," + blob + ");";
    Object.assign(attributes, props);
    attributes["data-src"] = attributes.src;
    attributes["data-srcset"] = attributes.srcset;
    return attributes;
}

async function getBadges(badgePath="src/badges", props={}) {
    let badges = await getFilePaths(badgePath);
    let tags = badges.map((url) => basename(url).split("-badge")[0]);
    let tmp;
    badges = await Promise.all(badges.map(async function (url) {
        const tag = basename(url).split("-badge")[0];
        const metadata = await getBadgeMeta(url, props);
        return {metadata, tag};
    }));
    badges = badges.reduce(function (acc, val) {
        if (!acc[val.tag]) {
            acc[val.tag] = val.metadata;
        }
        return acc;
    }, Object.create(null));
    if (badges["placeholder"]) {
        tmp = badges["placeholder"];
        tags.forEach(function (tag) {
            badges[tag].srcset = tmp.srcset;
            badges[tag].style = tmp.style;
        });
    }
    return badges;
}

module.exports = Object.freeze({
    getBadges
});
