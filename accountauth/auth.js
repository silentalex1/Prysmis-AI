var existingToken = localStorage.getItem('token');
var existingUser = localStorage.getItem('user');

if (existingToken && existingUser) {
  fetch('/me?token=' + encodeURIComponent(existingToken))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.username) {
        location.href = '/dashboard/aibuild/index.html';
      }
    })
    .catch(function() {});
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.style.display = 'none'; });
  document.getElementById('tab' + (tab === 'create' ? 'Create' : 'Login')).classList.add('active');
  document.getElementById(tab + 'Tab').style.display = 'block';
  clearError('createError');
  clearError('loginError');
}

function showError(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('visible');
}

function clearError(id) {
  var el = document.getElementById(id);
  el.textContent = '';
  el.classList.remove('visible');
}

function setLoading(type, loading) {
  var btn = document.getElementById(type + 'Btn');
  var txt = document.getElementById(type + 'BtnText');
  var spin = document.getElementById(type + 'Spinner');
  btn.disabled = loading;
  txt.style.display = loading ? 'none' : 'inline';
  spin.style.display = loading ? 'inline-block' : 'none';
}

document.getElementById('createBtn').addEventListener('click', function() {
  clearError('createError');
  var username = document.getElementById('createUsername').value.trim();
  var password = document.getElementById('createPassword').value;

  if (!username) { showError('createError', 'Please enter a username'); return; }
  if (!password) { showError('createError', 'Please enter a password'); return; }
  if (username.length < 3) { showError('createError', 'Username must be at least 3 characters'); return; }
  if (username.length > 24) { showError('createError', 'Username must be 24 characters or less'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showError('createError', 'Username can only contain letters, numbers, and underscores'); return; }
  if (password.length < 6) { showError('createError', 'Password must be at least 6 characters'); return; }

  setLoading('create', true);

  fetch('/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  })
  .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
  .then(function(res) {
    setLoading('create', false);
    if (res.status === 200 && res.data.success) {
      localStorage.setItem('user', res.data.username);
      localStorage.setItem('token', res.data.token);
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showError('createError', res.data.error || 'Failed to create account');
    }
  })
  .catch(function() {
    setLoading('create', false);
    showError('createError', 'Network error. Please try again.');
  });
});

document.getElementById('loginBtn').addEventListener('click', function() {
  clearError('loginError');
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;

  if (!username) { showError('loginError', 'Please enter your username'); return; }
  if (!password) { showError('loginError', 'Please enter your password'); return; }

  setLoading('login', true);

  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  })
  .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
  .then(function(res) {
    setLoading('login', false);
    if (res.status === 200 && res.data.success) {
      localStorage.setItem('user', res.data.username);
      localStorage.setItem('token', res.data.token);
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showError('loginError', res.data.error || 'Login failed');
    }
  })
  .catch(function() {
    setLoading('login', false);
    showError('loginError', 'Network error. Please try again.');
  });
});

document.getElementById('createPassword').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('createBtn').click();
});

document.getElementById('loginPassword').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

document.getElementById('createUsername').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('createPassword').focus();
});

document.getElementById('loginUsername').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('loginPassword').focus();
});
