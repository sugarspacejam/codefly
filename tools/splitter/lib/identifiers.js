const RESERVED = new Set([
    'if', 'for', 'while', 'return', 'const', 'let', 'var', 'function', 'async',
    'await', 'new', 'try', 'catch', 'throw', 'class', 'typeof', 'instanceof',
    'true', 'false', 'null', 'undefined', 'else', 'switch', 'case', 'break',
]);

function listIdentifiers(source) {
    const names = new Set();
    const pattern = /\b[A-Za-z_$][\w$]*\b/g;
    let match = pattern.exec(source);
    while (match) {
        addIdentifier(names, match[0]);
        match = pattern.exec(source);
    }
    return Array.from(names).sort();
}

function addIdentifier(names, name) {
    if (RESERVED.has(name)) {
        return;
    }
    names.add(name);
}

module.exports = { listIdentifiers };
