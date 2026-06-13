const { readText, writeJson } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const targetPath = requireArg(args, 1, 'manifest file');
    const source = readText(sourcePath);
    writeJson(targetPath, manifestItems(source));
}

function manifestItems(source) {
    const items = [];
    for (const record of listFunctions(source)) {
        items.push(toManifestItem(record));
    }
    return items;
}

function toManifestItem(record) {
    return {
        name: record.name,
        start: record.start,
        end: record.end,
        hash: hashText(record.source),
    };
}

function hashText(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = Math.imul(31, hash) + text.charCodeAt(index);
    }
    return String(hash);
}

run(main);
