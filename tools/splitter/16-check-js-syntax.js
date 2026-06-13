const childProcess = require('child_process');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    childProcess.execFileSync('node', ['--check', sourcePath], { stdio: 'inherit' });
}

run(main);
