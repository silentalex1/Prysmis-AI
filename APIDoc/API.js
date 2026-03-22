document.getElementById('backBtn').addEventListener('click', function() {
  if (document.referrer && document.referrer !== '') {
    history.back();
  } else {
    location.href = '/dashboard/aibuild/index.html';
  }
});

document.querySelectorAll('.api-copy-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var text = btn.getAttribute('data-copy');
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
  });
});

document.querySelectorAll('.api-code-copy').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var targetId = btn.getAttribute('data-target');
    var pre = document.getElementById(targetId);
    var text = pre ? pre.textContent : '';
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    }).catch(function() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
  });
});

var navLinks = document.querySelectorAll('.api-nav-link');
var sections = document.querySelectorAll('.api-section');

function onScroll() {
  var scrollY = window.scrollY + 100;
  var current = '';
  sections.forEach(function(sec) {
    if (sec.offsetTop <= scrollY) current = sec.id;
  });
  navLinks.forEach(function(link) {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) link.classList.add('active');
  });
}

window.addEventListener('scroll', onScroll);

navLinks.forEach(function(link) {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    var target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
