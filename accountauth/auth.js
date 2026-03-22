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
  clearErr('loginErr');
  clearErr('signupErr');
}

function toggleEye(inputId, btnId) {
  var inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showErr(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

function clearErr(id) {
  var el = document.getElementById(id);
  el.textContent = '';
  el.classList.remove('show');
}

function setLoading(prefix, on) {
  document.getElementById(prefix + 'Btn').disabled = on;
  document.getElementById(prefix + 'BtnText').style.display = on ? 'none' : 'inline';
  document.getElementById(prefix + 'Spinner').style.display = on ? 'inline-block' : 'none';
}

document.getElementById('loginBtn').addEventListener('click', function() {
  clearErr('loginErr');
  var user = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  if (!user) { showErr('loginErr', 'Please enter your username'); return; }
  if (!pass) { showErr('loginErr', 'Please enter your password'); return; }
  setLoading('login', true);
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setLoading('login', false);
    if (res.s === 200 && res.d.success) {
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('token', res.d.token);
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showErr('loginErr', res.d.error || 'Login failed');
    }
  }).catch(function() {
    setLoading('login', false);
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
  setLoading('signup', true);
  fetch('/account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  }).then(function(r) { return r.json().then(function(d) { return { s: r.status, d: d }; }); })
  .then(function(res) {
    setLoading('signup', false);
    if (res.s === 200 && res.d.success) {
      localStorage.setItem('user', res.d.username);
      localStorage.setItem('token', res.d.token);
      location.href = '/dashboard/aibuild/index.html';
    } else {
      showErr('signupErr', res.d.error || 'Failed to create account');
    }
  }).catch(function() {
    setLoading('signup', false);
    showErr('signupErr', 'Network error. Please try again.');
  });
});

document.getElementById('loginPass').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});
document.getElementById('loginUser').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('loginPass').focus();
});
document.getElementById('signupPass').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('signupBtn').click();
});
document.getElementById('signupUser').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('signupPass').focus();
});
