window.addEventListener('DOMContentLoaded', () => {
    const tl = gsap.timeline();

    tl.to("#baseplate", { 
        scale: 1, 
        duration: 1.2, 
        ease: "power4.out" 
    })
    .to(".block", { 
        opacity: 1, 
        y: -15, 
        stagger: 0.15, 
        duration: 0.8, 
        ease: "back.out(1.7)" 
    }, "-=0.5")
    .to("#loading-text", { 
        opacity: 0, 
        duration: 0.4, 
        delay: 0.8 
    })
    .to("#loader", { 
        opacity: 0,
        duration: 1, 
        ease: "expo.inOut",
        onComplete: () => {
            document.getElementById('loader').style.display = 'none';
        }
    })
    .to("#content", { 
        opacity: 1, 
        duration: 1.5,
        ease: "power2.out"
    }, "-=0.4");

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('span');
            const isHidden = answer.classList.contains('hidden');
            document.querySelectorAll('.faq-answer').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.faq-item span').forEach(el => el.innerText = '+');
            if (isHidden) {
                answer.classList.remove('hidden');
                icon.innerText = '-';
            }
        });
    });

    fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
            gsap.to("#user-count", { innerText: data.users, snap: { innerText: 1 }, duration: 2, ease: "power2.out" });
            gsap.to("#project-count", { innerText: data.projects, snap: { innerText: 1 }, duration: 2.5, ease: "power2.out" });
        })
        .catch(() => {
            document.getElementById('user-count').innerText = "1,204";
            document.getElementById('project-count').innerText = "8,492";
        });
});
