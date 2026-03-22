var storedToken = localStorage.getItem('token');
var storedUser = localStorage.getItem('user');
var adminLayout = document.getElementById('adminLayout');
var gateOverlay = document.getElementById('gateOverlay');

function blockAccess() {
  if (adminLayout) adminLayout.style.display = 'none';
  if (gateOverlay) gateOverlay.style.display = 'none';
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isAdmin');
  location.href = '/accountauth/index.html';
}

function showPanel() {
  if (gateOverlay) gateOverlay.style.display = 'none';
  if (adminLayout) adminLayout.style.display = 'flex';
  document.getElementById('adminUserTag').textContent = storedUser || 'Admin';
  showPage('stats');
  loadStats();
}

function showPage(page) {
  document.querySelectorAll('.admin-page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.admin-nav-btn').forEach(function(b) { b.classList.remove('active'); });
  var pageEl = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
  var navEl = document.getElementById('nav' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  var titles = { stats: 'Website Stats', control: 'Admin Control' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (page === 'control') loadControl();
}

function fmtDate(ts) {
  if (!ts) return 'Unknown';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    .then(function(r) {
      if (r.status === 401 || r.status === 403) { blockAccess(); return null; }
      return r.json();
    })
    .then(function(data) {
      if (!data) return;
      document.getElementById('statAdmins').textContent = data.adminCount || 0;
      var users = data.users || [];
      var body = document.getElementById('usersTableBody');
      if (users.length === 0) { body.innerHTML = '<div class="empty-table">No users found.</div>'; return; }
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

function loadControl() {
  document.getElementById('controlTableBody').innerHTML = '<div class="table-loading">Loading...</div>';
  fetch('/admin/users?token=' + encodeURIComponent(storedToken))
    .then(function(r) {
      if (r.status === 401 || r.status === 403) { blockAccess(); return null; }
      return r.json();
    })
    .then(function(data) {
      if (!data) return;
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

if (!storedToken || !storedUser) {
  blockAccess();
} else {
  fetch('/me?token=' + encodeURIComponent(storedToken))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d.username || !d.isAdmin) {
        blockAccess();
      } else {
        storedUser = d.username;
        showPanel();
      }
    }).catch(function() { blockAccess(); });
}
