function findFunctionStarts(source) {
    const starts = [];
    const pattern = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(/g;
    let match = pattern.exec(source);
    while (match) {
        starts.push({ name: functionName(match), index: match.index });
        match = pattern.exec(source);
    }
    return starts;
}

function findFunctionEnd(source, startIndex) {
    const bodyStart = source.indexOf('{', startIndex);
    if (bodyStart === -1) {
        throw new Error(`Function body not found at index ${startIndex}`);
    }
    return findMatchingBrace(source, bodyStart) + 1;
}

function findMatchingBrace(source, openIndex) {
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        if (depth === 0) return index;
    }
    throw new Error(`Unclosed function body at index ${openIndex}`);
}

function listFunctions(source) {
    const records = [];
    for (const item of findFunctionStarts(source)) {
        records.push(functionRecord(source, item));
    }
    return records;
}

function functionRecord(source, item) {
    const end = findFunctionEnd(source, item.index);
    return { name: item.name, start: item.index, end, source: source.slice(item.index, end) };
}

function functionName(match) {
    if (match[1]) {
        return match[1];
    }
    if (match[2]) {
        return match[2];
    }
    throw new Error('Function name missing');
}

module.exports = { listFunctions, findFunctionEnd };
