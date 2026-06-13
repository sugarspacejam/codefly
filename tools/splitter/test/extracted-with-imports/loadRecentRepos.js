import { readFileSync } from 'fs';
import path from 'path';
const SHARED_CONFIG = { timeout: 5000 };

function loadRecentRepos() {
    const data = readFileSync(path.join(process.cwd(), 'repos.json'));
    const config = SHARED_CONFIG;
    return JSON.parse(data);
}