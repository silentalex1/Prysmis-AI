var storedToken = localStorage.getItem('token');
var storedUser = localStorage.getItem('user');
var isAdmin = localStorage.getItem('isAdmin') === 'true';

var gateOverlay = document.getElementById('gateOverlay');
var adminLayout = document.getElementById('adminLayout');

function showGate() {
  gateOverlay.style.display = 'flex';
  adminLayout.style.display = 'none';
}

function showPanel() {
  gateOverlay.style.display = 'none';
  adminLayout.style.display = 'flex';
  document.getElementById('adminUserTag').textContent = storedUser || 'Admin';
  showPage('stats');
  loadStats();
}

function showPage(page) {
  document.querySelectorAll('.admin-page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.admin-nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1)).classList.add('active');
  document.getElementById('nav' + page.charAt(0).toUpperCase() + page.slice(1)).classList.add('active');
  var titles = { stats: 'Website Stats', control: 'Admin Control' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (page === 'control') loadControl();
}

function fmtDate(ts) {
  if (!ts) return 'Unknown';
  var d = new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function loadStats() {
  document.getElementById('statUsers').textContent = '-';
  document.getElementById('statActive').textContent = '-';
  document.getElementById('statProjects').textContent = '-';
  document.getElementById('statAdmins').textContent = '-';
  document.getElementById('usersTableBody').innerHTML = '<div class="table-loading">Loading...</div>';

  fetch('/stats').then(function(r) { return r.json(); }).then(function(data) {
    document.getElementById('statUsers').textContent = data.users || 0;
    document.getElementById('statActive').textContent = data.active || 0;
    document.getElementById('statProjects').textContent = data.projects || 0;
  }).catch(function() {});

  fetch('/admin/users?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      document.getElementById('statAdmins').textContent = data.adminCount || 0;
      var users = data.users || [];
      var body = document.getElementById('usersTableBody');
      if (users.length === 0) {
        body.innerHTML = '<div class="empty-table">No users found.</div>';
        return;
      }
      var html = '<div class="user-row-head"><span>Username</span><span>Joined</span><span>Chats</span><span>Role</span></div>';
      users.forEach(function(u) {
        html += '<div class="user-row">';
        html += '<span class="user-name">' + escHtml(u.username) + '</span>';
        html += '<span class="user-joined">' + fmtDate(u.created) + '</span>';
        html += '<span class="user-chats">' + (u.chatCount || 0) + '</span>';
        html += '<span class="user-badge"><span class="' + (u.isAdmin ? 'badge-admin' : 'badge-user') + '">' + (u.isAdmin ? 'Admin' : 'User') + '</span></span>';
        html += '</div>';
      });
      body.innerHTML = html;
    }).catch(function() {
      document.getElementById('usersTableBody').innerHTML = '<div class="empty-table">Could not load users.</div>';
    });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function verifyTokenIsAdmin() {
  if (!storedToken) { showGate(); return; }
  fetch('/me?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.isAdmin) {
        storedUser = d.username;
        localStorage.setItem('isAdmin', 'true');
        showPanel();
      } else {
        showGate();
      }
    }).catch(function() { showGate(); });
}

verifyTokenIsAdmin();

var gateBtn = document.getElementById('gateBtn');
var gateCode = document.getElementById('gateCode');
var gateErr = document.getElementById('gateErr');

function showGateErr(msg) {
  gateErr.textContent = msg;
  gateErr.classList.add('show');
}

function clearGateErr() {
  gateErr.textContent = '';
  gateErr.classList.remove('show');
}

function setGateLoading(on) {
  gateBtn.disabled = on;
  document.getElementById('gateBtnText').style.display = on ? 'none' : 'inline';
  document.getElementById('gateSpinner').style.display = on ? 'inline-block' : 'none';
}

gateBtn.addEventListener('click', function() {
  clearGateErr();
  var code = gateCode.value.trim();
  if (!code) { showGateErr('Please enter the admin passcode'); return; }
  if (!code.startsWith('PrysmisAI_admin')) { showGateErr('Invalid code format'); return; }
  setGateLoading(true);
  fetch('/admin/gate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setGateLoading(false);
    if (res.s === 200 && res.d.success) {
      storedToken = res.d.token;
      storedUser = res.d.username;
      localStorage.setItem('token', res.d.token);
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('isAdmin', 'true');
      showPanel();
    } else {
      showGateErr(res.d.error || 'Invalid or expired code');
    }
  }).catch(function() {
    setGateLoading(false);
    showGateErr('Network error. Please try again.');
  });
});

gateCode.addEventListener('keydown', function(e) { if (e.key === 'Enter') gateBtn.click(); });

function loadControl() {
  document.getElementById('controlTableBody').innerHTML = '<div class="table-loading">Loading...</div>';
  fetch('/admin/users?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var users = data.users || [];
      document.getElementById('controlUserCount').textContent = users.length;
      var body = document.getElementById('controlTableBody');
      if (users.length === 0) { body.innerHTML = '<div class="empty-table">No users found.</div>'; return; }
      var html = '<div class="user-row-head control-head"><span>Username</span><span>Joined</span><span>Chats</span><span>Role</span><span></span></div>';
      users.forEach(function(u) {
        html += '<div class="user-row control-row" data-user="' + escHtml(u.username) + '">';
        html += '<span class="user-name">' + escHtml(u.username) + '</span>';
        html += '<span class="user-joined">' + fmtDate(u.created) + '</span>';
        html += '<span class="user-chats">' + (u.chatCount || 0) + '</span>';
        html += '<span class="user-badge"><span class="' + (u.isAdmin ? 'badge-admin' : 'badge-user') + '">' + (u.isAdmin ? 'Admin' : 'User') + '</span></span>';
        if (!u.isAdmin) {
          html += '<span><button class="remove-user-btn" onclick="removeUser(\'' + escHtml(u.username) + '\')">Remove</button></span>';
        } else {
          html += '<span><span class="remove-protected">Protected</span></span>';
        }
        html += '</div>';
      });
      body.innerHTML = html;
    }).catch(function() {
      document.getElementById('controlTableBody').innerHTML = '<div class="empty-table">Could not load users.</div>';
    });
}

function removeUser(username) {
  if (!confirm('Remove user "' + username + '"? This cannot be undone.')) return;
  fetch('/admin/users/' + encodeURIComponent(username) + '?token=' + encodeURIComponent(storedToken), { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        var row = document.querySelector('.control-row[data-user="' + username + '"]');
        if (row) { row.style.opacity = '0'; row.style.transition = 'opacity 0.2s'; setTimeout(function() { if (row.parentNode) row.parentNode.removeChild(row); loadControl(); }, 220); }
      } else {
        alert(data.error || 'Failed to remove user');
      }
    }).catch(function() { alert('Network error'); });
}

document.getElementById('adminLogoutBtn').addEventListener('click', function() {
  if (storedToken) {
    fetch('/logout?token=' + encodeURIComponent(storedToken), { method: 'POST' }).catch(function() {});
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isAdmin');
  location.href = '/accountauth/index.html';
});
