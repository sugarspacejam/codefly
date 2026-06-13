const childProcess = require('child_process');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    runTool('09-check-duplicate-functions.js', sourcePath);
    runTool('10-check-function-size.js', sourcePath, '30');
    runTool('11-check-file-size.js', sourcePath, '300');
    runTool('16-check-js-syntax.js', sourcePath);
    runTool('19-check-no-heredoc.js', sourcePath);
}

function runTool(tool, ...args) {
    childProcess.execFileSync('node', [`tools/splitter/${tool}`, ...args], { stdio: 'inherit' });
}

run(main);
