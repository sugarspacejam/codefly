function updateHover() {
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(raycastTargets, true);
    const hoverTarget = resolveHoverTarget(intersects);

    if (hoveredMesh && hoveredMesh !== hoverTarget?.mesh) {
        hoveredMesh.material.emissiveIntensity = 0.3;
        hoveredMesh.scale.setScalar(1);
    }

    if (hoveredFunctionMesh && hoveredFunctionMesh !== hoverTarget?.functionMesh) {
        hoveredFunctionMesh.material.emissiveIntensity = 0.4;
        hoveredFunctionMesh.scale.setScalar(1);
    }

    if (!hoverTarget) {
        hoveredNode = null;
        hoveredNodeId = null;
        hoveredMesh = null;
        hoveredFunctionMesh = null;
        if (!selectedNodeId) {
            resetCallChainHighlight();
        }
        const tt = document.getElementById('hoverTooltip');
        if (tt) tt.style.display = 'none';
        document.getElementById('previewCard').style.display = 'none';
        return;
    }

    hoveredNode = hoverTarget.node;
    hoveredNodeId = hoverTarget.node.id;
    hoveredMesh = hoverTarget.mesh;
    hoveredFunctionMesh = hoverTarget.functionMesh;

    hoveredMesh.material.emissiveIntensity = 0.8;
    hoveredMesh.scale.setScalar(1.3);

    if (hoveredFunctionMesh) {
        hoveredFunctionMesh.material.emissiveIntensity = 0.8;
        hoveredFunctionMesh.scale.setScalar(1.15);
    }

    if (!selectedNodeId) {
        resetCallChainHighlight();
        applyCallChainHighlight(hoveredNodeId);
    }

    // Show compact hover tooltip (top-left, non-blocking)
    const inE = adjacencyIn[hoveredNodeId] || 0;
    const outE = adjacencyOut[hoveredNodeId] || 0;
    const fnCount = hoveredNode.definitions ? hoveredNode.definitions.length : 0;
    const sizeLabel = hoveredNode.size ? ` · ${(hoveredNode.size / 1024).toFixed(1)}KB` : '';
    const parseMeta = getParseStatusMeta(getNodeParseStatus(hoveredNode));
    const parseLabel = ` <span style="color:${parseMeta.color}">[${parseMeta.label}]</span>`;
    const tooltip = document.getElementById('hoverTooltip');
    if (tooltip) {
        tooltip.innerHTML = `<span style="color:#fff;font-weight:bold">${escapeHtml(hoveredNode.fullPath)}</span><br><span style="color:#8f8">${hoveredNode.lines} lines${sizeLabel} · ${hoveredNode.lang || ''}</span>${parseLabel}  <span style="color:#5cc">↑${inE} ↓${outE}</span>  <span style="color:#f80">${fnCount > 0 ? fnCount + ' defs — click to expand' : 'click for file details'}</span>`;
        tooltip.style.display = 'block';
    }
    document.getElementById('previewCard').style.display = 'none';
}
