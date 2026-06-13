const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const maxLines = Number(requireArg(args, 1, 'max lines'));
    const oversized = oversizedFunctions(listFunctions(readText(sourcePath)), maxLines);
    if (oversized.length > 0) {
        throw new Error(formatOversized(oversized));
    }
}

function lineCount(record) {
    return record.source.split('\n').length;
}

function oversizedFunctions(records, maxLines) {
    const oversized = [];
    for (const record of records) {
        if (lineCount(record) > maxLines) {
            oversized.push(record);
        }
    }
    return oversized;
}

function formatOversized(records) {
    const lines = [];
    for (const record of records) {
        lines.push(`${record.name}:${lineCount(record)}`);
    }
    return lines.join('\n');
}

run(main);
