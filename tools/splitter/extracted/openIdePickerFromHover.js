window.openIdePickerFromHover = function() {
    if (!hoveredNode) {
        throw new Error('Hover a node before opening IDE picker');
    }
    openIdePicker(hoveredNode, null);
}
