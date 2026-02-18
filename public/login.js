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

document.getElementById('forgotPasswordLink')?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;

    if (!email) {
        alert('Please enter your email address first so we know where to send the link.');
        return;
    }

    // Give the user a little feedback that we are working on it
    const originalText = e.target.innerText;
    e.target.innerText = 'Sending...';

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        alert(data.message); // "If that account exists, a reset link has been sent."
    } catch (err) {
        console.error('Forgot password error:', err);
        alert('Could not process request at this time.');
    } finally {
        e.target.innerText = originalText;
    }
});