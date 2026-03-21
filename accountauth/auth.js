document.getElementById('createBtn').onclick = async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) return alert('Fill both fields');
  const res = await fetch('/account', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password})
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('user', username);
    location.href = '/dashboard/aibuild';
  } else {
    alert(data.error || 'Failed to create account');
  }
};
