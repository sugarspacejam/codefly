const { readText } = require('./lib/files');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const source = readText(sourcePath);
    if (source.includes('<<')) {
        throw new Error(`Heredoc marker found in ${sourcePath}`);
    }
}

run(main);
