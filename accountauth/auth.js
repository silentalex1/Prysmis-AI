var existingToken = localStorage.getItem('token');
var existingUser = localStorage.getItem('user');

if (existingToken && existingUser) {
  fetch('/me?token=' + encodeURIComponent(existingToken))
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.username) location.href = '/dashboard/aibuild/index.html'; })
    .catch(function() {});
}

function switchTab(tab) {
  document.getElementById('loginCard').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signupCard').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('adminCard').style.display = tab === 'admin' ? 'block' : 'none';
  clearErr('loginErr');
  clearErr('signupErr');
  clearErr('adminErr');
  clearErr('createAdminErr');
}

function switchAdminSub(sub) {
  var loginForm = document.getElementById('adminLoginForm');
  var createForm = document.getElementById('adminCreateForm');
  var loginPill = document.getElementById('adminSubLogin');
  var createPill = document.getElementById('adminSubCreate');
  if (sub === 'login') {
    loginForm.style.display = 'block';
    createForm.style.display = 'none';
    loginPill.classList.add('active');
    createPill.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    createForm.style.display = 'block';
    createPill.classList.add('active');
    loginPill.classList.remove('active');
  }
  clearErr('adminErr');
  clearErr('createAdminErr');
}

function toggleEye(inputId) {
  var inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showErr(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearErr(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}

function setLoading(btnId, textId, spinnerId, on) {
  document.getElementById(btnId).disabled = on;
  document.getElementById(textId).style.display = on ? 'none' : 'inline';
  document.getElementById(spinnerId).style.display = on ? 'inline-block' : 'none';
}

document.getElementById('loginBtn').addEventListener('click', function() {
  clearErr('loginErr');
  var user = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  if (!user) { showErr('loginErr', 'Please enter your username'); return; }
  if (!pass) { showErr('loginErr', 'Please enter your password'); return; }
  setLoading('loginBtn', 'loginBtnText', 'loginSpinner', true);
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setLoading('loginBtn', 'loginBtnText', 'loginSpinner', false);
    if (res.s === 200 && res.d.success) {
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('token', res.d.token);
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showErr('loginErr', res.d.error || 'Login failed');
    }
  }).catch(function() {
    setLoading('loginBtn', 'loginBtnText', 'loginSpinner', false);
    showErr('loginErr', 'Network error. Please try again.');
  });
});

document.getElementById('signupBtn').addEventListener('click', function() {
  clearErr('signupErr');
  var user = document.getElementById('signupUser').value.trim();
  var pass = document.getElementById('signupPass').value;
  if (!user) { showErr('signupErr', 'Please enter a username'); return; }
  if (user.length < 3) { showErr('signupErr', 'Username must be at least 3 characters'); return; }
  if (user.length > 24) { showErr('signupErr', 'Username must be 24 characters or less'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(user)) { showErr('signupErr', 'Letters, numbers, and underscores only'); return; }
  if (!pass) { showErr('signupErr', 'Please enter a password'); return; }
  if (pass.length < 6) { showErr('signupErr', 'Password must be at least 6 characters'); return; }
  setLoading('signupBtn', 'signupBtnText', 'signupSpinner', true);
  fetch('/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setLoading('signupBtn', 'signupBtnText', 'signupSpinner', false);
    if (res.s === 200 && res.d.success) {
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('token', res.d.token);
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showErr('signupErr', res.d.error || 'Failed to create account');
    }
  }).catch(function() {
    setLoading('signupBtn', 'signupBtnText', 'signupSpinner', false);
    showErr('signupErr', 'Network error. Please try again.');
  });
});

document.getElementById('adminBtn').addEventListener('click', function() {
  clearErr('adminErr');
  var user = document.getElementById('adminUser').value.trim();
  var pass = document.getElementById('adminPass').value;
  if (!user) { showErr('adminErr', 'Please enter admin username'); return; }
  if (!pass) { showErr('adminErr', 'Please enter admin password'); return; }
  setLoading('adminBtn', 'adminBtnText', 'adminSpinner', true);
  fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setLoading('adminBtn', 'adminBtnText', 'adminSpinner', false);
    if (res.s === 200 && res.d.success) {
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('token', res.d.token);
      localStorage.setItem('isAdmin', 'true');
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showErr('adminErr', res.d.error || 'Admin login failed');
    }
  }).catch(function() {
    setLoading('adminBtn', 'adminBtnText', 'adminSpinner', false);
    showErr('adminErr', 'Network error. Please try again.');
  });
});

document.getElementById('createAdminBtn').addEventListener('click', function() {
  clearErr('createAdminErr');
  var user = document.getElementById('createAdminUser').value.trim().toLowerCase();
  var pass = document.getElementById('createAdminPass').value;
  var code = document.getElementById('createAdminCode').value.trim();
  if (!user) { showErr('createAdminErr', 'Please enter your username'); return; }
  if (!pass) { showErr('createAdminErr', 'Please enter a password'); return; }
  if (pass.length < 6) { showErr('createAdminErr', 'Password must be at least 6 characters'); return; }
  if (!code) { showErr('createAdminErr', 'Please enter the admin code from Discord'); return; }
  if (!code.startsWith('PrysmisAI_admin')) { showErr('createAdminErr', 'Invalid code format'); return; }
  setLoading('createAdminBtn', 'createAdminBtnText', 'createAdminSpinner', true);
  fetch('/admin/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass, code: code })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setLoading('createAdminBtn', 'createAdminBtnText', 'createAdminSpinner', false);
    if (res.s === 200 && res.d.success) {
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('token', res.d.token);
      localStorage.setItem('isAdmin', 'true');
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showErr('createAdminErr', res.d.error || 'Failed to create admin account');
    }
  }).catch(function() {
    setLoading('createAdminBtn', 'createAdminBtnText', 'createAdminSpinner', false);
    showErr('createAdminErr', 'Network error. Please try again.');
  });
});

document.getElementById('loginPass').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });
document.getElementById('loginUser').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('loginPass').focus(); });
document.getElementById('signupPass').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('signupBtn').click(); });
document.getElementById('signupUser').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('signupPass').focus(); });
document.getElementById('adminUser').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('adminPass').focus(); });
document.getElementById('adminPass').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('adminBtn').click(); });
document.getElementById('createAdminUser').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('createAdminPass').focus(); });
document.getElementById('createAdminPass').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('createAdminCode').focus(); });
document.getElementById('createAdminCode').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('createAdminBtn').click(); });
