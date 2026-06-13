import { readFileSync } from 'fs';
import path from 'path';

const SHARED_CONFIG = { timeout: 5000 };
const MAX_RETRIES = 3;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadRecentRepos() {
    const data = readFileSync(path.join(process.cwd(), 'repos.json'));
    const config = SHARED_CONFIG;
    return JSON.parse(data);
}

function showLoadError(msg) {
    const el = document.getElementById('loadError');
    el.textContent = msg;
    el.style.display = 'block';
}
