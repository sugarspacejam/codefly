function buildAnalyticsFilters() {
    const langContainer = document.getElementById('langFilters');
    const folderContainer = document.getElementById('folderFilters');
    if (langContainer.children.length > 0) return;

    const langs = {};
    const folders = {};
    for (const n of graphData.nodes) {
        langs[n.lang] = (langs[n.lang] || 0) + 1;
        folders[n.folder] = (folders[n.folder] || 0) + 1;
    }

    for (const [lang, count] of Object.entries(langs).sort((a, b) => b[1] - a[1])) {
        const btn = document.createElement('button');
        btn.className = 'ap-btn';
        btn.textContent = `${lang} (${count})`;
        btn.onclick = () => filterByLang(lang);
        langContainer.appendChild(btn);
    }

    for (const [folder, count] of Object.entries(folders).sort((a, b) => b[1] - a[1])) {
        const btn = document.createElement('button');
        btn.className = 'ap-btn';
        btn.textContent = `${folder}/ (${count})`;
        btn.onclick = () => {
            if (collapsedFolders.has(folder)) {
                collapsedFolders.delete(folder);
                btn.style.textDecoration = '';
                btn.style.color = '';
            } else {
                collapsedFolders.add(folder);
                btn.style.textDecoration = 'line-through';
                btn.style.color = '#555';
            }
            applyFolderCollapse();
        };
        folderContainer.appendChild(btn);
    }
}
