const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { listIdentifiers } = require('./lib/identifiers');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const source = readText(sourcePath);
    const records = listFunctions(source);
    const functionNames = functionNameSet(records);
    printJson(globalRecords(records, functionNames));
}

function globalsFor(record, functionNames) {
    const identifiers = listIdentifiers(record.source);
    return { name: record.name, globals: externalIdentifiers(identifiers, functionNames) };
}

function functionNameSet(records) {
    const names = new Set();
    for (const record of records) {
        names.add(record.name);
    }
    return names;
}

function globalRecords(records, functionNames) {
    const globals = [];
    for (const record of records) {
        globals.push(globalsFor(record, functionNames));
    }
    return globals;
}

function externalIdentifiers(identifiers, functionNames) {
    const globals = [];
    for (const name of identifiers) {
        if (!functionNames.has(name)) {
            globals.push(name);
        }
    }
    return globals;
}

run(main);
