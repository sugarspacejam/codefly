const { readText, writeText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const functionName = requireArg(args, 1, 'function name');
    const targetPath = requireArg(args, 2, 'target file');
    const record = findFunction(readText(sourcePath), functionName);
    writeText(targetPath, record.source);
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
