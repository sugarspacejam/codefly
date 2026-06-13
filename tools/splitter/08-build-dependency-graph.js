const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const source = readText(sourcePath);
    const records = listFunctions(source);
    const names = functionNameSet(records);
    printJson(graphNodes(records, names));
}

function functionNameSet(records) {
    const names = new Set();
    for (const record of records) {
        names.add(record.name);
    }
    return names;
}

function graphNodes(records, names) {
    const nodes = [];
    for (const record of records) {
        nodes.push(graphNode(record, names));
    }
    return nodes;
}

function graphNode(record, names) {
    return { name: record.name, calls: calledFunctions(record.source, names) };
}

function calledFunctions(source, names) {
    const calls = new Set();
    const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
    let match = pattern.exec(source);
    while (match) {
        if (names.has(match[1])) calls.add(match[1]);
        match = pattern.exec(source);
    }
    return Array.from(calls).sort();
}

run(main);
