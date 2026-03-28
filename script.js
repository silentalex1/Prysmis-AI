window.addEventListener('DOMContentLoaded', () => {
    const inner = document.getElementById('loader-inner');
    const barWrap = document.getElementById('loader-bar-wrap');
    const bar = document.getElementById('loader-bar');
    const status = document.getElementById('loader-status');

    let progress = 0;

    gsap.to(inner, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });

    gsap.to('.prism-ring-1', { opacity: 1, duration: 0.4, delay: 0.3 });
    gsap.to('.prism-ring-2', { opacity: 1, duration: 0.4, delay: 0.5 });
    gsap.to('.prism-ring-3', { opacity: 1, duration: 0.4, delay: 0.7 });
    gsap.to('.prism-dot', { opacity: 1, duration: 0.4, delay: 0.9 });
    gsap.to(barWrap, { opacity: 1, duration: 0.4, delay: 0.9 });
    gsap.to(status, { opacity: 1, duration: 0.4, delay: 1.0 });

    const fill = () => {
        progress += Math.random() * 18 + 8;
        if (progress >= 100) {
            progress = 100;
            bar.style.width = '100%';
            setTimeout(() => {
                gsap.to('#loader', {
                    opacity: 0,
                    duration: 0.55,
                    ease: 'power2.inOut',
                    onComplete: () => {
                        document.getElementById('loader').style.display = 'none';
                    }
                });
                gsap.to('#content', { opacity: 1, duration: 0.7, delay: 0.3 });
            }, 320);
            return;
        }
        bar.style.width = progress + '%';
        setTimeout(fill, Math.random() * 180 + 80);
    };

    setTimeout(fill, 1200);

    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('span');
            const isHidden = answer.style.display === 'none' || answer.style.display === '';

            document.querySelectorAll('.faq-answer').forEach(el => { el.style.display = 'none'; });
            document.querySelectorAll('.faq-item span').forEach(el => { el.innerText = '+'; });

            if (isHidden) {
                answer.style.display = 'block';
                icon.innerText = '−';
            }
        });
    });
});
