const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

const TEST_DIR = __dirname;
const INPUT_FILE = path.join(TEST_DIR, 'input.js');
const EXTRACT_DIR = path.join(TEST_DIR, 'extracted');
const MANIFEST_FILE = path.join(TEST_DIR, 'manifest.json');
const REBUILT_FILE = path.join(TEST_DIR, 'rebuilt.js');
const MANIFEST_AFTER_FILE = path.join(TEST_DIR, 'manifest-after.json');

function runTool(tool, ...args) {
    const toolPath = path.join(__dirname, '..', tool);
    const result = childProcess.execFileSync('node', [toolPath, ...args], { encoding: 'utf8' });
    return result;
}

function runToolSafe(tool, ...args) {
    try {
        return runTool(tool, ...args);
    } catch (error) {
        return null;
    }
}

function clean() {
    if (fs.existsSync(EXTRACT_DIR)) {
        fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(MANIFEST_FILE)) {
        fs.unlinkSync(MANIFEST_FILE);
    }
    if (fs.existsSync(REBUILT_FILE)) {
        fs.unlinkSync(REBUILT_FILE);
    }
    if (fs.existsSync(MANIFEST_AFTER_FILE)) {
        fs.unlinkSync(MANIFEST_AFTER_FILE);
    }
    fs.mkdirSync(EXTRACT_DIR, { recursive: true });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertThrows(fn, message) {
    let threw = false;
    try {
        fn();
    } catch (error) {
        threw = true;
    }
    assert(threw, message);
}

function main() {
    clean();
    console.log('E2E Test: Splitter Toolkit');
    console.log('=================================');
    
    console.log('1. Inventory functions...');
    const inventory = JSON.parse(runTool('01-list-functions.js', INPUT_FILE));
    console.log(`   Found ${inventory.length} functions`);
    assert(inventory.length === 7, 'Should have 7 functions');
    
    console.log('2. Run safety checks...');
    runTool('20-run-split-safety-checks.js', INPUT_FILE);
    console.log('   All checks passed');
    
    console.log('3. Extract all functions...');
    runTool('03-extract-functions.js', INPUT_FILE, EXTRACT_DIR);
    const extractedFiles = fs.readdirSync(EXTRACT_DIR);
    console.log(`   Extracted ${extractedFiles.length} files`);
    assert(extractedFiles.length === 7, 'Should have 7 extracted files');
    
    console.log('4. Build manifest...');
    runTool('04-build-function-manifest.js', INPUT_FILE, MANIFEST_FILE);
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE));
    console.log(`   Manifest has ${manifest.length} entries`);
    assert(manifest.length === 7, 'Manifest should have 7 entries');
    
    console.log('5. Verify each extract...');
    for (const item of manifest) {
        const extractPath = path.join(EXTRACT_DIR, `${item.name}.js`);
        runTool('05-verify-extracted-function.js', INPUT_FILE, item.name, extractPath, MANIFEST_FILE);
    }
    console.log('   All extracts verified');
    
    console.log('6. Build dependency graph...');
    const graph = JSON.parse(runTool('08-build-dependency-graph.js', INPUT_FILE));
    console.log(`   Graph has ${graph.length} nodes`);
    assert(graph.length === 7, 'Graph should have 7 nodes');
    
    console.log('7. Rebuild file from extracts...');
    const manifestWithPaths = manifest.map((item) => ({
        ...item,
        path: path.join(EXTRACT_DIR, `${item.name}.js`),
    }));
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifestWithPaths));
    runTool('14-build-module-file.js', MANIFEST_FILE, REBUILT_FILE);
    console.log('   Rebuilt file created');
    
    console.log('8. Verify syntax of rebuilt file...');
    runTool('16-check-js-syntax.js', REBUILT_FILE);
    console.log('   Syntax valid');
    
    console.log('9. Compare manifests...');
    runTool('04-build-function-manifest.js', REBUILT_FILE, MANIFEST_AFTER_FILE);
    runTool('13-compare-manifests.js', MANIFEST_FILE, MANIFEST_AFTER_FILE);
    console.log('   Manifests match');
    
    console.log('10. Verify rebuilt file contains all functions...');
    const rebuiltInventory = JSON.parse(runTool('01-list-functions.js', REBUILT_FILE));
    assert(rebuiltInventory.length === inventory.length, 'Rebuilt file should have same function count');
    for (const item of inventory) {
        const rebuiltItem = rebuiltInventory.find((r) => r.name === item.name);
        assert(rebuiltItem, `Function ${item.name} missing from rebuilt file`);
    }
    console.log('   All functions preserved in rebuilt file');
    
    console.log('');
    console.log('=================================');
    console.log('E2E Test: PASSED');
    console.log('=================================');
}

main();
