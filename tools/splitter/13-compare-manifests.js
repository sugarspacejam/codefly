const { readJson } = require('./lib/files');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const beforePath = requireArg(args, 0, 'before manifest');
    const afterPath = requireArg(args, 1, 'after manifest');
    const before = readJson(beforePath);
    const after = readJson(afterPath);
    assertSameManifest(before, after);
}

function assertSameManifest(before, after) {
    const beforeText = JSON.stringify(stripPositions(before));
    const afterText = JSON.stringify(stripPositions(after));
    if (beforeText !== afterText) {
        throw new Error('Function manifest changed');
    }
}

function stripPositions(items) {
    const stripped = [];
    for (const item of items) {
        stripped.push({ name: item.name, hash: item.hash });
    }
    return stripped;
}

run(main);
