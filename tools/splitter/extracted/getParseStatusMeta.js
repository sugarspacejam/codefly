function getParseStatusMeta(status) {
    if (status === UI_PARSE_STATUS_UNSUPPORTED) {
        return { label: 'UNSUPPORTED', color: '#bbbbbb', accent: 0x9a9a9a };
    }
    if (status === UI_PARSE_STATUS_PARTIAL) {
        return { label: 'PARTIAL', color: '#ffd65a', accent: 0xffd65a };
    }
    return { label: 'FULL', color: '#8f8', accent: 0x33ff99 };
}
