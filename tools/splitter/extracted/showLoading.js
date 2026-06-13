function showLoading(on) {
    const bar = document.getElementById('loadingBar');
    const fill = bar.querySelector('.fill');
    if (on) {
        bar.style.display = 'block';
        fill.style.width = '0%';
        let pct = 0;
        const interval = setInterval(() => {
            pct += Math.random() * 15;
            if (pct > 90) pct = 90;
            fill.style.width = pct + '%';
            if (!bar.dataset.active) {
                clearInterval(interval);
                fill.style.width = '100%';
            }
        }, 300);
        bar.dataset.active = '1';
    } else {
        delete bar.dataset.active;
        bar.style.display = 'none';
    }
}
