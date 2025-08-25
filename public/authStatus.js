// public/authStatus.js
document.addEventListener('DOMContentLoaded', async () => {
  const authBar = document.getElementById('authStatus');
  if (!authBar) return;

  try {
    const res = await fetch('/api/auth/user', {
      credentials: 'include',
    });

    if (res.ok) {
      const user = await res.json();
      authBar.innerHTML = `
        <span class="auth-welcome">Welcome, ${user.email}</span>
        <a href="/dashboard.html" class="auth-link">Dashboard</a>
        <button id="logoutBtn" class="auth-btn">Logout</button>
      `;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.reload();
      });
    } else {
      authBar.innerHTML = `
        <a href="/login.html" class="auth-btn">Login</a>
        <a href="/register.html" class="auth-btn">Register</a>
      `;
    }
  } catch (err) {
    console.error('Error checking auth:', err);
  }
});
