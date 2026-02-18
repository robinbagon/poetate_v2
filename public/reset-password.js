document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetForm');
    const messageDisplay = document.getElementById('message');

    // Extract the token from the URL path: /reset-password/TOKEN_HERE
    const pathParts = window.location.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;

        if (password !== confirm) {
            messageDisplay.innerText = "Passwords do not match.";
            messageDisplay.style.color = "red";
            return;
        }

        try {
            messageDisplay.innerText = "Updating...";
            
            const response = await fetch(`/api/auth/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok) {
                alert("Password updated successfully! Redirecting to login...");
                window.location.href = '/index.html';
            } else {
                messageDisplay.innerText = data.message || "Reset failed.";
                messageDisplay.style.color = "red";
            }
        } catch (err) {
            console.error('Reset error:', err);
            messageDisplay.innerText = "An error occurred. Please try again.";
        }
    });
});