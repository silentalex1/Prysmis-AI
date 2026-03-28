const userTab = document.getElementById('user-tab');
const adminTab = document.getElementById('admin-tab');
const userSection = document.getElementById('user-section');
const adminSection = document.getElementById('admin-section');
const createBtn = document.getElementById('create-btn');

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

createBtn.addEventListener('click', () => {
    window.location.href = '/dashboard';
});
