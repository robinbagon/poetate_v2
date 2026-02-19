// public/authUI.js

export const authUI = {
    /**
     * Checks user session and updates the top-right bar.
     * Designed to fail silently on 401 (not logged in).
     */
    async init() {
        const container = document.getElementById('authStatus');
        if (!container) return;

        try {
            const res = await fetch('/api/auth/user');
            
            // 401 means "Not Logged In" - this is expected behavior, not an error.
            if (res.status === 401) {
                this.renderLoggedOut(container);
                return;
            }

            if (res.ok) {
                const user = await res.json();
                this.renderLoggedIn(container, user);
            } else {
                // For any other non-ok status (500, etc.)
                this.renderLoggedOut(container);
            }
        } catch (err) {
            // Only logs if there's a genuine network/server failure
            console.warn('Auth system temporarily unavailable.');
            this.renderLoggedOut(container);
        }
    },

    renderLoggedIn(container, user) {
        container.innerHTML = `
            <span>${user.email}</span>
            <button class="nav-btn" onclick="window.location.href='/dashboard.html'">Dashboard</button>
            <button id="logoutAction" class="nav-btn">Logout</button>
        `;
        
        const logoutBtn = document.getElementById('logoutAction');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },

    renderLoggedOut(container) {
        container.innerHTML = `
            <button class="nav-btn" onclick="window.location.href='/login.html'">Login</button>
            <button class="nav-btn" onclick="window.location.href='/register.html'">Register</button>
        `;
    },

    async logout() {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                window.location.reload();
            }
        } catch (err) {
            console.error('Logout failed:', err);
            alert('Logout failed. Please try again.');
        }
    }
};

authUI.init();