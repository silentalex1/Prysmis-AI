(function () {
  var ADMIN_USER = 'prysmisadmin';
  var ADMIN_PASS = 'admin2025';
  var ADMIN_CODE = '482910';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem('prysmis_users') || '{}'); } catch(e) { return {}; }
  }

  function saveUsers(users) {
    localStorage.setItem('prysmis_users', JSON.stringify(users));
  }

  function setSession(username, role) {
    localStorage.setItem('prysmis_session', JSON.stringify({ username: username, role: role || 'user', time: Date.now() }));
  }

  function showAlert(id, type, msg) {
    var el = document.getElementById(id);
    el.className = 'auth-alert show ' + type;
    el.textContent = msg;
  }

  function hideAlert(id) {
    var el = document.getElementById(id);
    el.className = 'auth-alert';
    el.textContent = '';
  }

  window.switchTab = function (tab) {
    document.querySelectorAll('.auth-tab').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.auth-panel').forEach(function(panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + tab);
    });
    hideAlert('create-alert');
    hideAlert('login-alert');
    hideAlert('admin-alert');
  };

  window.togglePw = function (inputId, btn) {
    var inp = document.getElementById(inputId);
    if (inp.type === 'password') {
      inp.type = 'text';
    } else {
      inp.type = 'password';
    }
  };

  window.createAccount = function () {
    var username = document.getElementById('create-username').value.trim();
    var password = document.getElementById('create-password').value;
    hideAlert('create-alert');
    if (!username || username.length < 3) {
      showAlert('create-alert', 'error', 'Username must be at least 3 characters.');
      return;
    }
    if (!password || password.length < 6) {
      showAlert('create-alert', 'error', 'Password must be at least 6 characters.');
      return;
    }
    var users = getUsers();
    if (users[username.toLowerCase()]) {
      showAlert('create-alert', 'error', 'That username is already taken.');
      return;
    }
    users[username.toLowerCase()] = { username: username, password: password };
    saveUsers(users);
    setSession(username, 'user');
    showAlert('create-alert', 'success', 'Account created! Taking you to the AI...');
    setTimeout(function() { window.location.href = '/aichat'; }, 1000);
  };

  window.loginAccount = function () {
    var username = document.getElementById('login-username').value.trim();
    var password = document.getElementById('login-password').value;
    hideAlert('login-alert');
    if (!username || !password) {
      showAlert('login-alert', 'error', 'Please fill in both fields.');
      return;
    }
    var users = getUsers();
    var user = users[username.toLowerCase()];
    if (!user || user.password !== password) {
      showAlert('login-alert', 'error', 'Wrong username or password.');
      return;
    }
    setSession(user.username, 'user');
    showAlert('login-alert', 'success', 'Logged in! Taking you to the AI...');
    setTimeout(function() { window.location.href = '/aichat'; }, 900);
  };

  window.adminLogin = function () {
    var username = document.getElementById('admin-username').value.trim();
    var password = document.getElementById('admin-password').value;
    var passcode = document.getElementById('admin-passcode').value.trim();
    hideAlert('admin-alert');
    if (!username || !password || !passcode) {
      showAlert('admin-alert', 'error', 'Please fill in all fields.');
      return;
    }
    if (username !== ADMIN_USER || password !== ADMIN_PASS || passcode !== ADMIN_CODE) {
      showAlert('admin-alert', 'error', 'Invalid admin credentials.');
      return;
    }
    setSession(username, 'admin');
    showAlert('admin-alert', 'success', 'Admin access granted. Redirecting...');
    setTimeout(function() { window.location.href = '/aichat'; }, 900);
  };

  var session = localStorage.getItem('prysmis_session');
  if (session) {
    try {
      var s = JSON.parse(session);
      if (s && s.username) {
        window.location.href = '/aichat';
      }
    } catch(e) {}
  }
})();
