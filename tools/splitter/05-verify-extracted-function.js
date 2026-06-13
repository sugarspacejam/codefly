const { readText, readJson } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const functionName = requireArg(args, 1, 'function name');
    const extractedPath = requireArg(args, 2, 'extracted file');
    const manifestPath = requireArg(args, 3, 'manifest file');
    const manifest = readJson(manifestPath);
    const original = findFunction(readText(sourcePath), functionName);
    const originalHash = findHash(manifest, functionName);
    const extracted = readText(extractedPath).trimEnd();
    const extractedHash = hashText(extracted);
    if (originalHash !== extractedHash) {
        throw new Error(`Extracted function hash mismatch: ${functionName}`);
    }
}

function findFunction(source, functionName) {
    for (const record of listFunctions(source)) {
        if (record.name === functionName) {
            return record;
        }
    }
    throw new Error(`Function not found: ${functionName}`);
}

function findHash(manifest, functionName) {
    for (const item of manifest) {
        if (item.name === functionName) {
            return item.hash;
        }
    }
    throw new Error(`Function not found in manifest: ${functionName}`);
}

function hashText(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = Math.imul(31, hash) + text.charCodeAt(index);
    }
    return String(hash);
}

run(main);
