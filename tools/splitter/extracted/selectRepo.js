function selectRepo(fullName, provider = 'github') {
    const url = provider === 'gitlab' 
        ? `https://gitlab.com/${fullName}` 
        : `https://github.com/${fullName}`;
    document.getElementById('repoInput').value = url;
    document.getElementById('startBtn').disabled = false;
    loadAndStart();
}
