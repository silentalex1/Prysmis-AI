window.addEventListener('DOMContentLoaded', () => {
    const tl = gsap.timeline();

    gsap.to("#loader-prism", {
        rotation: 225,
        duration: 2,
        repeat: -1,
        ease: "power2.inOut"
    });

    tl.to("#loading-text", { opacity: 1, duration: 1 })
      .to("#loader", { 
          opacity: 0, 
          duration: 1.2, 
          ease: "expo.inOut",
          delay: 1,
          onComplete: () => {
              document.getElementById('loader').style.display = 'none';
          }
      })
      .to("#content", { 
          opacity: 1, 
          y: 0, 
          duration: 1.5, 
          ease: "expo.out" 
      }, "-=0.5")
      .from(".hero-text", {
          y: 40,
          opacity: 0,
          duration: 1.2,
          ease: "power4.out"
      }, "-=1")
      .from(".stats-box", {
          scale: 0.95,
          opacity: 0,
          duration: 1,
          ease: "power3.out"
      }, "-=0.8");

    fetch('/api/stats')
        .then(res => res.json())
        .then(data => {
            gsap.to("#user-count", { innerText: data.users, snap: { innerText: 1 }, duration: 2 });
            gsap.to("#project-count", { innerText: data.projects, snap: { innerText: 1 }, duration: 2.5 });
        })
        .catch(() => {
            document.getElementById('user-count').innerText = "1,204";
            document.getElementById('project-count').innerText = "8,492";
        });
});
