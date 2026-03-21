function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  event.target.classList.add('active');
  document.getElementById(tab + 'Tab').style.display = 'block';
}

document.getElementById('createBtn').onclick = async () => {
  const username = document.getElementById('createUsername').value.trim();
  const password = document.getElementById('createPassword').value.trim();
  if (!username || !password) return alert('Fill both fields');
  const res = await fetch('/account', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password})
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('user', username);
    localStorage.setItem('token', data.token);
    location.href = '/dashboard/aibuild/index.html';
  } else {
    alert(data.error || 'Failed to create account');
  }
};

document.getElementById('loginBtn').onclick = async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!username || !password) return alert('Fill both fields');
  const res = await fetch('/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password})
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('user', username);
    localStorage.setItem('token', data.token);
    location.href = '/dashboard/aibuild/index.html';
  } else {
    alert(data.error || 'Login failed');
  }
};
