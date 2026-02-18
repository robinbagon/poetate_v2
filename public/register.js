// register.js

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // 📥 Check for a poem created as a guest
    const pendingPoemId = localStorage.getItem('pendingPoemId');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ✅ Send the pendingPoemId so the backend can link it to the new user
            body: JSON.stringify({ email, password, pendingPoemId })
        });

        if (response.ok) {
            // ✨ Success! Clear the storage so we don't try to claim it again
            if (pendingPoemId) {
                localStorage.removeItem('pendingPoemId');
            }
            // Redirect to dashboard where the new poem should now appear
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