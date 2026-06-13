const { readText, writeText } = require('./lib/files');
const { requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const targetPath = requireArg(args, 1, 'target file');
    const importsJson = requireArg(args, 2, 'imports JSON');
    const varsJson = requireArg(args, 3, 'vars JSON');
    const imports = JSON.parse(importsJson);
    const vars = JSON.parse(varsJson);
    const targetSource = readText(targetPath);
    const newSource = prependImportsAndVars(targetSource, imports, vars);
    writeText(targetPath, newSource);
}

function prependImportsAndVars(targetSource, imports, vars) {
    const lines = [];
    for (const importLine of imports) {
        lines.push(importLine);
    }
    for (const varLine of vars) {
        lines.push(varLine);
    }
    lines.push('');
    lines.push(targetSource);
    return lines.join('\n');
}

run(main);
