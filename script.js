function loadStats() {
  fetch('/stats').then(function(r) { return r.json(); }).then(function(d) {
    var u = document.getElementById('statUsers');
    var a = document.getElementById('statActive');
    var p = document.getElementById('statProjects');
    if (u) u.textContent = d.users || 0;
    if (a) a.textContent = d.active || 0;
    if (p) p.textContent = d.projects || 0;
  }).catch(function() {});
}

loadStats();
setInterval(loadStats, 15000);
