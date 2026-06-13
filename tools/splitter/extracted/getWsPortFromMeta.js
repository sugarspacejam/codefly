function getWsPortFromMeta() {
    const meta = document.querySelector('meta[name="ws-port"]');
    if (!meta) return '8091';
    const value = (meta.getAttribute('content') || '').trim();
    return value || '8091';
}
