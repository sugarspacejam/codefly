const { readJson, readText, writeText } = require('./lib/files');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const manifestPath = requireArg(args, 0, 'manifest file');
    const outputPath = requireArg(args, 1, 'output file');
    const manifest = readJson(manifestPath);
    const moduleText = assembleModuleText(manifest);
    writeText(outputPath, `${moduleText}\n`);
}

function assembleModuleText(manifest) {
    const texts = [];
    for (const item of manifest) {
        texts.push(readText(item.path));
    }
    return texts.join('\n\n');
}

run(main);
