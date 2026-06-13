const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { listIdentifiers } = require('./lib/identifiers');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const excludeFunction = requireArg(args, 1, 'function to exclude');
    const importOrVar = requireArg(args, 2, 'import or variable name');
    const source = readText(sourcePath);
    const records = listFunctions(source);
    const allIdentifiers = [];
    for (const record of records) {
        if (record.name === excludeFunction) {
            continue;
        }
        const ids = listIdentifiers(record.source);
        for (const id of ids) {
            allIdentifiers.push(id);
        }
    }
    const isUsed = checkUsed(allIdentifiers, importOrVar);
    printJson({ used: isUsed });
}

function checkUsed(identifiers, name) {
    for (const id of identifiers) {
        if (id === name) {
            return true;
        }
    }
    return false;
}

run(main);
