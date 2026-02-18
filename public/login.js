document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // 📥 Grab the pending poem ID if it exists in this browser
    const pendingPoemId = localStorage.getItem('pendingPoemId');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            // ✅ Send the ID to the backend along with credentials
            body: JSON.stringify({ email, password, pendingPoemId })
        });

        if (response.ok) {
            // ✨ Success! Remove the pending ID from memory
            if (pendingPoemId) {
                localStorage.removeItem('pendingPoemId');
            }
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