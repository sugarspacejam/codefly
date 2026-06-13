const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const records = listFunctions(readText(sourcePath));
    printJson({ functions: records.length, oversized: oversized(records), ready: true });
}

function oversized(records) {
    const names = [];
    for (const record of records) {
        if (record.source.split('\n').length > 30) {
            names.push(record.name);
        }
    }
    return names;
}

run(main);
