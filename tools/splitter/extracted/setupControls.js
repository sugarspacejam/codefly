function setupControls() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();

        // Don't capture keys when typing in chat
        if (document.activeElement && document.activeElement.id === 'chatInput') return;

        if (key === ' ') e.preventDefault();
        keys[key] = true;

        if (key === 'f' && gameStarted) {
            isFlying = !isFlying;
            if (!isFlying) verticalVelocity = 0;
        }
        if (key === 'c' && gameStarted) {
            isThirdPerson = !isThirdPerson;
            updateCameraView();
        }
        if (key === 'enter' && gameStarted) {
            const chatInput = document.getElementById('chatInput');
            if (chatInput.style.display === 'none' || chatInput.style.display === '') {
                chatInput.style.display = 'block';
                chatInput.focus();
                document.exitPointerLock();
            }
        }
        if (key === 'tab' && gameStarted) {
            e.preventDefault();
            const pl = document.getElementById('playerList');
            pl.style.display = pl.style.display === 'block' ? 'none' : 'block';
        }
        if (key === 'g' && gameStarted) {
            const ap = document.getElementById('analyticsPanel');
            if (ap.style.display === 'block') {
                ap.style.display = 'none';
            } else {
                ap.style.display = 'block';
                document.exitPointerLock();
                buildAnalyticsFilters();
            }
        }
        if (key === 'k' && (e.ctrlKey || e.metaKey) && gameStarted) {
            e.preventDefault();
            const overlay = document.getElementById('searchOverlay');
            if (overlay.style.display === 'block') {
                closeSearch();
            } else {
                openSearch();
            }
        }
        if (key === 'l' && gameStarted && e.shiftKey) {
            if (hoveredNode) {
                addLandmark(hoveredNode);
            }
        }
        if (key === 'l' && gameStarted && !e.shiftKey) {
            window.cycleLayoutMode();
        }
        if (key === 'b' && gameStarted && selectedNodeId) {
            showBlastRadius();
        }
        if (key === 'o' && gameStarted && hoveredNode) {
            openIdePicker(hoveredNode, null);
        }
        if (key === 'v' && gameStarted) {
            fileLayoutMode = !fileLayoutMode;
            const currently = [...expandedNodes];
            for (const nid of currently) {
                collapseFunctions(nid);
                expandFunctions(nid);
            }
            const stats = document.getElementById('graphStats');
            if (stats) stats.textContent = fileLayoutMode ? 'View: FILE LAYOUT (vertical)' : 'View: ORBIT mode';
            setTimeout(() => { if (stats) stats.textContent = ''; }, 2000);
        }
        if (key === 'p' && gameStarted) {
            const panel = document.getElementById('folderSettingsPanel');
            if (!panel) {
                throw new Error('folderSettingsPanel element missing from DOM');
            }
            if (panel.style.display === 'block') {
                window.closeFolderSettings();
            } else {
                openFolderSettings();
            }
        }
        if (key === 'm' && gameStarted) {
            const panel = document.getElementById('motionControls');
            if (!panel) {
                throw new Error('motionControls element missing from DOM');
            }
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
        if (key === 'escape' && gameStarted) {
            closeSearch();
            document.getElementById('analyticsPanel').style.display = 'none';
        }
    });

    document.addEventListener('keyup', (e) => {
        if (document.activeElement && document.activeElement.id === 'chatInput') return;
        keys[e.key.toLowerCase()] = false;
    });

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = !!document.pointerLockElement;
    });

    renderer.domElement.addEventListener('click', (e) => {
        if (gameStarted && !isPointerLocked) {
            renderer.domElement.requestPointerLock();
            return;
        }

        if (!gameStarted || !isPointerLocked) {
            return;
        }

        if (hoveredFunctionMesh) {
            const ud = hoveredFunctionMesh.userData;
            const parentMesh = nodeMeshes.get(ud.parentNodeId);
            if (!parentMesh || !parentMesh.userData.nodeData) {
                throw new Error('Function node has no valid parent node data');
            }
            openIdePicker(parentMesh.userData.nodeData, ud.functionLine);
        } else if (hoveredNode) {
            selectExecutionPathNode(hoveredNode.id, false);
            if (hoveredNode.definitions && hoveredNode.definitions.length > 0) {
                toggleFunctionExpansion(hoveredNode.id);
            } else {
                showNodeFallbackPanel(hoveredNode);
            }
        } else {
            selectedNodeId = null;
            resetCallChainHighlight();
            document.getElementById('functionPanel').style.display = 'none';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked || !gameStarted) return;

        playerYaw -= e.movementX * mouseSensitivity;
        playerPitch -= e.movementY * mouseSensitivity;
        playerPitch = Math.max(-maxPitch, Math.min(maxPitch, playerPitch));

        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
        const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), playerPitch);
        playerGroup.quaternion.copy(pitchQ).premultiply(yawQ);
    });

    renderer.domElement.addEventListener('wheel', (e) => {
        if (!gameStarted) return;
        cameraDistance += e.deltaY * 0.02;
        cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
        updateCameraView();
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    });
}
