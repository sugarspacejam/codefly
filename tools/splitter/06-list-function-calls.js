const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const source = readText(sourcePath);
    const records = listFunctions(source);
    const functionNames = functionNameSet(records);
    printJson(callRecords(records, functionNames));
}

function functionNameSet(records) {
    const names = new Set();
    for (const record of records) {
        names.add(record.name);
    }
    return names;
}

function callRecords(records, functionNames) {
    const calls = [];
    for (const record of records) {
        calls.push(callsFor(record, functionNames));
    }
    return calls;
}

function callsFor(record, functionNames) {
    return {
        name: record.name,
        calls: Array.from(findCalls(record.source, functionNames)).sort(),
    };
}

function findCalls(source, functionNames) {
    const calls = new Set();
    const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
    let match = pattern.exec(source);
    while (match) {
        if (functionNames.has(match[1]) && match[1] !== 'function') {
            calls.add(match[1]);
        }
        match = pattern.exec(source);
    }
    return calls;
}

run(main);
