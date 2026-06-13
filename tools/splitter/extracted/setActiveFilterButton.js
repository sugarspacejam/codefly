function setActiveFilterButton(labelText) {
    const buttons = document.querySelectorAll('.ap-btn');
    buttons.forEach((btn) => {
        if (btn.textContent.trim() === labelText.trim()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}
