const path = require('path');
const { readJson, writeText } = require('./lib/files');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const manifestPath = requireArg(args, 0, 'manifest file');
    const outputPath = requireArg(args, 1, 'output file');
    const manifest = readJson(manifestPath);
    const lines = buildExportLines(manifest);
    writeText(outputPath, `${lines.join('\n')}\n`);
}

function buildExportLines(manifest) {
    const lines = [];
    for (const item of manifest) {
        lines.push(exportLine(item));
    }
    return lines;
}

function exportLine(item) {
    const modulePath = path.basename(item.path, '.js');
    return `export { ${item.name} } from './${modulePath}.js';`;
}

run(main);
