const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const duplicates = duplicateNames(listFunctions(readText(sourcePath)));
    if (duplicates.length > 0) {
        throw new Error(`Duplicate functions: ${duplicates.join(', ')}`);
    }
}

function duplicateNames(records) {
    const seen = new Set();
    const duplicates = [];
    for (const record of records) {
        addName(record.name, seen, duplicates);
    }
    return duplicates;
}

function addName(name, seen, duplicates) {
    if (seen.has(name)) {
        duplicates.push(name);
        return;
    }
    seen.add(name);
}

run(main);
