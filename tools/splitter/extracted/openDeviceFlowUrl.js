window.openDeviceFlowUrl = function() {
    if (!githubDeviceFlow.verificationUri) {
        throw new Error('GitHub verification URL missing');
    }
    window.open(githubDeviceFlow.verificationUri, '_blank');
}
