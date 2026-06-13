const fs = require('fs');
const path = require('path');
const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const outputDir = requireArg(args, 1, 'output directory');
    const collisions = findCollisions(listFunctions(readText(sourcePath)), outputDir);
    if (collisions.length > 0) {
        throw new Error(`Output collisions: ${collisionNames(collisions)}`);
    }
}

function findCollisions(records, outputDir) {
    const collisions = [];
    for (const record of records) {
        if (exists(outputDir, record)) {
            collisions.push(record);
        }
    }
    return collisions;
}

function collisionNames(records) {
    const names = [];
    for (const record of records) {
        names.push(record.name);
    }
    return names.join(', ');
}

function exists(outputDir, record) {
    return fs.existsSync(path.join(outputDir, `${record.name}.js`));
}

run(main);
