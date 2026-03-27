const userTab = document.getElementById('user-tab');
const adminTab = document.getElementById('admin-tab');
const userSection = document.getElementById('user-section');
const adminSection = document.getElementById('admin-section');
const createBtn = document.getElementById('create-btn');

userTab.addEventListener('click', () => {
    userSection.classList.remove('hidden');
    adminSection.classList.add('hidden');
    userTab.classList.add('bg-white/5', 'text-blue-400');
    userTab.classList.remove('text-gray-500');
    adminTab.classList.remove('bg-white/5', 'text-blue-400');
    adminTab.classList.add('text-gray-500');
});

adminTab.addEventListener('click', () => {
    adminSection.classList.remove('hidden');
    userSection.classList.add('hidden');
    adminTab.classList.add('bg-white/5', 'text-blue-400');
    adminTab.classList.remove('text-gray-500');
    userTab.classList.remove('bg-white/5', 'text-blue-400');
    userTab.classList.add('text-gray-500');
});

createBtn.addEventListener('click', () => {
    window.location.href = '/dashboard';
});
