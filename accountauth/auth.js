const userTab = document.getElementById('user-tab');
const adminTab = document.getElementById('admin-tab');
const userSection = document.getElementById('user-section');
const adminSection = document.getElementById('admin-section');
const createBtn = document.getElementById('create-btn');
const adminBtn = document.getElementById('admin-btn');
const userError = document.getElementById('user-error');
const adminError = document.getElementById('admin-error');

userTab.addEventListener('click', () => {
    userSection.classList.remove('hidden');
    adminSection.classList.add('hidden');
    userTab.classList.add('active');
    adminTab.classList.remove('active');
});

adminTab.addEventListener('click', () => {
    adminSection.classList.remove('hidden');
    userSection.classList.add('hidden');
    adminTab.classList.add('active');
    userTab.classList.remove('active');
});

function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
}

function hideError(el) {
    el.style.display = 'none';
}

createBtn.addEventListener('click', async () => {
    hideError(userError);
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showError(userError, 'Please fill in all fields.');
        return;
    }

    createBtn.textContent = 'Creating...';
    createBtn.disabled = true;

    try {
        const res = await fetch('/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError(userError, data.error || 'Something went wrong.');
            createBtn.textContent = 'Create account.';
            createBtn.disabled = false;
            return;
        }

        if (data.token) {
            localStorage.setItem('prysmis_token', data.token);
            localStorage.setItem('prysmis_user', data.username);
        }

        window.location.href = '/dashboard';
    } catch {
        showError(userError, 'Could not connect to server.');
        createBtn.textContent = 'Create account.';
        createBtn.disabled = false;
    }
});

adminBtn.addEventListener('click', async () => {
    hideError(adminError);
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const code = document.getElementById('admin-code').value.trim();

    if (!username || !password || !code) {
        showError(adminError, 'Please fill in all fields.');
        return;
    }

    adminBtn.textContent = 'Logging in...';
    adminBtn.disabled = true;

    try {
        const res = await fetch('/admin/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, code })
        });
        const data = await res.json();

        if (!res.ok) {
            showError(adminError, data.error || 'Login failed.');
            adminBtn.textContent = 'Login to admin panel.';
            adminBtn.disabled = false;
            return;
        }

        if (data.token) {
            localStorage.setItem('prysmis_token', data.token);
            localStorage.setItem('prysmis_user', data.username);
        }

        window.location.href = '/dashboard';
    } catch {
        showError(adminError, 'Could not connect to server.');
        adminBtn.textContent = 'Login to admin panel.';
        adminBtn.disabled = false;
    }
});
