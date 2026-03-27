window.addEventListener('DOMContentLoaded', () => {
    const tl = gsap.timeline();

    tl.to("#baseplate", { scale: 1, duration: 1, ease: "power4.out" })
      .to(".block", { 
          opacity: 1, 
          y: -10, 
          stagger: 0.15, 
          duration: 0.6, 
          ease: "bounce.out" 
      }, "-=0.3")
      .to("#loading-text", { opacity: 0, duration: 0.4, delay: 0.6 })
      .to("#loader", { 
          opacity: 0,
          duration: 0.8, 
          ease: "power2.inOut",
          onComplete: () => {
              document.getElementById('loader').style.display = 'none';
          }
      })
      .to("#content", { 
          opacity: 1, 
          duration: 1 
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

    document.getElementById('cta-button').addEventListener('click', () => {
        window.location.href = '/accountauth';
    });
});
