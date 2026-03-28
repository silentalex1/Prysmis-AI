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
        stagger: {
            each: 0.1,
            from: "random"
        }, 
        duration: 0.8, 
        ease: "back.out(2)" 
    }, "-=0.4")
    .to("#loading-text", { 
        opacity: 0, 
        duration: 0.5, 
        delay: 0.8 
    })
    .to("#loader", { 
        yPercent: -100,
        duration: 1.2, 
        ease: "expo.inOut",
        onComplete: () => {
            document.getElementById('loader').style.display = 'none';
        }
    })
    .from("#content", { 
        y: 20,
        opacity: 0, 
        duration: 1,
        ease: "power3.out"
    }, "-=0.6");

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
});
