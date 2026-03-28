window.addEventListener('DOMContentLoaded', () => {

  const loader = document.getElementById('loader');
  const site = document.getElementById('site');

  const statusMessages = ['Generating world...', 'Placing blocks...', 'Growing terrain...', 'Adding details...', 'Almost ready...'];
  const statusEl = document.querySelector('.loader-status');
  let msgIndex = 0;

  const msgInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % statusMessages.length;
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.textContent = statusMessages[msgIndex];
      statusEl.style.opacity = '1';
    }, 200);
  }, 700);

  statusEl.style.transition = 'opacity 0.2s';

  setTimeout(() => {
    clearInterval(msgInterval);
    statusEl.style.opacity = '0';
    setTimeout(() => {
      statusEl.textContent = 'Ready.';
      statusEl.style.opacity = '1';
    }, 200);
  }, 2100 + 1800 - 400);

  setTimeout(() => {
    loader.style.transition = 'opacity 0.7s ease';
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
      site.classList.remove('hidden');
      site.style.opacity = '0';
      site.style.transition = 'opacity 0.6s ease';
      setTimeout(() => {
        site.style.opacity = '1';
      }, 50);
    }, 700);
  }, 4400);

  const faqButtons = document.querySelectorAll('.faq-q');

  faqButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      faqButtons.forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        const a = b.nextElementSibling;
        a.classList.remove('open');
      });
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        btn.nextElementSibling.classList.add('open');
      }
    });
  });

  const userCount = document.getElementById('userCount');
  const projectCount = document.getElementById('projectCount');

  function animateCount(el, target, duration) {
    const start = performance.now();
    const from = 0;
    const update = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(from + (target - from) * ease).toLocaleString();
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(userCount, 0, 1200);
        animateCount(projectCount, 0, 1400);
        statsObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });

  const statsRow = document.querySelector('.stats-row');
  if (statsRow) statsObserver.observe(statsRow);

  const revealEls = document.querySelectorAll('.feature-card, .faq-item, .cta-section h2, .hero-inner > *');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    revealObserver.observe(el);
  });

  const revealObserver2 = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  revealEls.forEach(el => revealObserver2.observe(el));

});
