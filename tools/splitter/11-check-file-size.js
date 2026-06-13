const { readText } = require('./lib/files');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const maxLines = Number(requireArg(args, 1, 'max lines'));
    const lines = readText(sourcePath).split('\n').length;
    if (lines > maxLines) {
        throw new Error(`File exceeds ${maxLines} lines: ${lines}`);
    }
}

run(main);
