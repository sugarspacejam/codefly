const fs = require('fs');
const path = require('path');

function requireFile(filePath) {
    if (!filePath) {
        throw new Error('Missing file path');
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        throw new Error(`File does not exist: ${resolved}`);
    }
    return resolved;
}

function readText(filePath) {
    const resolved = requireFile(filePath);
    return fs.readFileSync(resolved, 'utf8');
}

function writeText(filePath, text) {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, text);
}

function readJson(filePath) {
    return JSON.parse(readText(filePath));
}

function writeJson(filePath, data) {
    writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

module.exports = { requireFile, readText, writeText, readJson, writeJson };
