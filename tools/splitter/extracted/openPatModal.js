function openPatModal(provider) {
    const modal = document.getElementById('patModal');
    const title = document.getElementById('patModalTitle');
    const input = document.getElementById('patModalInput');
    const link = document.getElementById('patModalLink');
    if (!modal || !title || !input || !link) {
        throw new Error('PAT modal elements missing from DOM');
    }
    modal.dataset.provider = provider;
    if (provider === 'github') {
        title.textContent = 'Connect GitHub — Personal Access Token';
        input.placeholder = 'ghp_xxxxxxxxxxxxxxxxxxxx';
        link.href = 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=CodeFly';
        link.textContent = 'Create GitHub token ↗';
    } else {
        title.textContent = 'Connect GitLab — Personal Access Token';
        input.placeholder = 'glpat-xxxxxxxxxxxxxxxxxxxx';
        link.href = 'https://gitlab.com/-/user_settings/personal_access_tokens?name=CodeFly&scopes=read_api,read_repository';
        link.textContent = 'Create GitLab token ↗';
    }
    input.value = '';
    modal.style.display = 'block';
}
