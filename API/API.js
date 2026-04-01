(function () {
  document.querySelectorAll('.api-copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pre = btn.closest('.api-code-block').querySelector('pre');
      if (pre) {
        navigator.clipboard.writeText(pre.textContent.trim()).then(function() {
          var orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = orig; }, 1500);
        });
      }
    });
  });

  var links = document.querySelectorAll('.api-sidebar-link');
  var sections = document.querySelectorAll('.api-section');

  window.addEventListener('scroll', function() {
    var scrollY = window.scrollY + 80;
    sections.forEach(function(section) {
      if (section.offsetTop <= scrollY && section.offsetTop + section.offsetHeight > scrollY) {
        links.forEach(function(l) { l.classList.remove('active'); });
        var match = document.querySelector('.api-sidebar-link[href="#' + section.id + '"]');
        if (match) match.classList.add('active');
      }
    });
  });
})();
