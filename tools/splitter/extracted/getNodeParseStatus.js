function getNodeParseStatus(node) {
    if (!node || !node.parseStatus) {
        return UI_PARSE_STATUS_FULL;
    }
    return node.parseStatus;
}
