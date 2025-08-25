document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            window.location.href = '/dashboard.html';
        } else {
            const data = await response.json();
            alert(data.message || 'Login failed');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('An error occurred during login.');
    }
});