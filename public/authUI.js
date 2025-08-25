// Check session status and update UI
async function checkUserStatus() {
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();

        const userEmailSpan = document.getElementById('userEmail');
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (data.loggedIn) {
            userEmailSpan.textContent = `Logged in as: ${data.email}`;
            loginBtn.style.display = 'none';
            registerBtn.style.display = 'none';
            logoutBtn.style.display = 'inline-block';
        } else {
            userEmailSpan.textContent = '';
            loginBtn.style.display = 'inline-block';
            registerBtn.style.display = 'inline-block';
            logoutBtn.style.display = 'none';
        }
    } catch (err) {
        console.error('Failed to check user session', err);
    }
}

// Attach event handlers
document.getElementById('loginBtn').addEventListener('click', () => {
    window.location.href = '/login.html';
});
document.getElementById('registerBtn').addEventListener('click', () => {
    window.location.href = '/register.html';
});
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
});

// Call it once on load
checkUserStatus();
