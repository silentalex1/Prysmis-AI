window.addEventListener('DOMContentLoaded', () => {
    const fill = document.getElementById('ld-fill');
    const inner = document.getElementById('ld-inner');

    gsap.to(inner, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.1 });

    let pct = 0;
    const pump = () => {
        pct = Math.min(100, pct + Math.random() * 22 + 6);
        fill.style.width = pct + '%';
        if (pct >= 100) {
            setTimeout(() => {
                gsap.to('#loader', { opacity: 0, duration: 0.5, ease: 'power2.inOut', onComplete: () => { document.getElementById('loader').style.display = 'none'; } });
                gsap.to('#content', { opacity: 1, duration: 0.65, delay: 0.25 });
            }, 280);
            return;
        }
        setTimeout(pump, Math.random() * 160 + 70);
    };
    setTimeout(pump, 900);

    document.querySelectorAll('.faq-item').forEach(item => {
        item.addEventListener('click', () => {
            const ans = item.querySelector('.faq-answer');
            const ico = item.querySelector('.faq-icon');
            const open = ans.style.display === 'block';

            document.querySelectorAll('.faq-answer').forEach(el => { el.style.display = 'none'; });
            document.querySelectorAll('.faq-icon').forEach(el => { el.textContent = '+'; });

            if (!open) {
                ans.style.display = 'block';
                ico.textContent = '−';
            }
        });
    });
});
