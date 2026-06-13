const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const functionName = requireArg(args, 1, 'function name');
    const record = findFunction(readText(sourcePath), functionName);
    printJson({ name: record.name, removeStart: record.start, removeEnd: record.end });
}

function findFunction(source, functionName) {
    for (const record of listFunctions(source)) {
        if (record.name === functionName) {
            return record;
        }
    }
    throw new Error(`Function not found: ${functionName}`);
}

run(main);
