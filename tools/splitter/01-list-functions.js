const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const source = readText(sourcePath);
    printJson(functionSummaries(source));
}

function functionSummaries(source) {
    const summaries = [];
    for (const record of listFunctions(source)) {
        summaries.push(toSummary(record));
    }
    return summaries;
}

function toSummary(record) {
    return {
        name: record.name,
        start: record.start,
        end: record.end,
        lines: record.source.split('\n').length,
    };
}

run(main);
