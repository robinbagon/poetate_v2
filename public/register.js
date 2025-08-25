// register.js

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            window.location.href = '/dashboard.html';
        } else {
            const data = await response.json();
            alert(data.message || 'Registration failed');
        }
    } catch (err) {
        console.error('Registration error:', err);
        alert('An error occurred during registration.');
    }
});