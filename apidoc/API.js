document.getElementById('backBtn').addEventListener('click', function() {
  if (document.referrer && document.referrer !== window.location.href) {
    history.back();
  } else {
    location.href = '/dashboard/aibuild/index.html';
  }
});

function copyText(text, btn, original) {
  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = 'Copied';
    setTimeout(function() { btn.textContent = original; }, 2000);
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied';
    setTimeout(function() { btn.textContent = original; }, 2000);
  });
}

document.querySelectorAll('.copy-url-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    copyText(btn.getAttribute('data-copy'), btn, 'Copy');
  });
});

document.querySelectorAll('.codebox-copy').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var pre = document.getElementById(btn.getAttribute('data-target'));
    copyText(pre ? pre.textContent : '', btn, 'Copy');
  });
});

var navLinks = document.querySelectorAll('.sidenav-link');
var sections = document.querySelectorAll('.section');

function updateActive() {
  var scrollY = window.scrollY + 80;
  var active = '';
  sections.forEach(function(s) {
    if (s.offsetTop <= scrollY) active = s.id;
  });
  navLinks.forEach(function(l) {
    var id = l.getAttribute('href').slice(1);
    l.classList.toggle('active', id === active);
  });
}

window.addEventListener('scroll', updateActive, { passive: true });
updateActive();

navLinks.forEach(function(link) {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    var target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
