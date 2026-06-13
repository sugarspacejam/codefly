const { readText } = require('./lib/files');
const { listFunctions } = require('./lib/functions');
const { listIdentifiers } = require('./lib/identifiers');
const { printJson, requireArg, run } = require('./lib/cli');

function main(args) {
    const sourcePath = requireArg(args, 0, 'source file');
    const functionName = requireArg(args, 1, 'function name');
    const source = readText(sourcePath);
    const record = findFunction(source, functionName);
    const functionIdentifiers = listIdentifiers(record.source);
    const imports = extractImports(source);
    const sharedVars = extractSharedVars(source);
    const usedImports = findUsedImports(functionIdentifiers, imports);
    const usedVars = findUsedVars(functionIdentifiers, sharedVars);
    printJson({ imports: usedImports, vars: usedVars });
}

function findFunction(source, functionName) {
    for (const record of listFunctions(source)) {
        if (record.name === functionName) {
            return record;
        }
    }
    throw new Error(`Function not found: ${functionName}`);
}

function extractImports(source) {
    const imports = [];
    const records = listFunctions(source);
    const functionRanges = getFunctionRanges(source, records);
    const lines = source.split('\n');
    let currentLine = 0;
    for (const line of lines) {
        if (isInsideFunction(currentLine, functionRanges)) {
            currentLine += 1;
            continue;
        }
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
            imports.push(trimmed);
        }
        currentLine += 1;
    }
    return imports;
}

function extractSharedVars(source) {
    const vars = [];
    const records = listFunctions(source);
    const functionRanges = getFunctionRanges(source, records);
    const lines = source.split('\n');
    let currentLine = 0;
    for (const line of lines) {
        if (isInsideFunction(currentLine, functionRanges)) {
            currentLine += 1;
            continue;
        }
        const trimmed = line.trim();
        if (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
            if (!trimmed.includes('=')) {
                currentLine += 1;
                continue;
            }
            vars.push(trimmed);
        }
        currentLine += 1;
    }
    return vars;
}

function getFunctionRanges(source, records) {
    const ranges = [];
    for (const record of records) {
        const startLine = sourceLineFromIndex(source, record.start);
        const endLine = sourceLineFromIndex(source, record.end);
        ranges.push({ start: startLine, end: endLine });
    }
    return ranges;
}

function sourceLineFromIndex(source, index) {
    let line = 0;
    let currentIndex = 0;
    while (currentIndex < index) {
        const char = source[currentIndex];
        if (char === '\n') {
            line += 1;
        }
        currentIndex += 1;
    }
    return line;
}

function isInsideFunction(line, ranges) {
    for (const range of ranges) {
        if (line >= range.start && line <= range.end) {
            return true;
        }
    }
    return false;
}

function findUsedImports(functionIdentifiers, imports) {
    const used = [];
    for (const importLine of imports) {
        for (const identifier of functionIdentifiers) {
            if (importLine.includes(identifier)) {
                used.push(importLine);
                break;
            }
        }
    }
    return used;
}

function findUsedVars(functionIdentifiers, vars) {
    const used = [];
    for (const varLine of vars) {
        const varName = extractVarName(varLine);
        for (const identifier of functionIdentifiers) {
            if (identifier === varName) {
                used.push(varLine);
                break;
            }
        }
    }
    return used;
}

function extractVarName(varLine) {
    const parts = varLine.split('=');
    const decl = parts[0].trim();
    const nameParts = decl.split(' ');
    return nameParts[nameParts.length - 1];
}

run(main);
