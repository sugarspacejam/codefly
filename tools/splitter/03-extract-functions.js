const path = require('path');
const { readText, writeText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const outputDir = requireArg(args, 1, 'output directory');
    const source = readText(sourcePath);
    for (const record of listFunctions(source)) {
        writeFunction(outputDir, record);
    }
}

function writeFunction(outputDir, record) {
    const targetPath = path.join(outputDir, `${record.name}.js`);
    writeText(targetPath, `${record.source}\n`);
}

run(main);
