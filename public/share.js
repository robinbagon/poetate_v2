// share.js

import { renderPoem } from './renderPoem.js';
import { initAnnotations } from './annotations.js';

const poemContentDiv = document.getElementById('poemContent');
const banner = document.getElementById('sharingBanner');
const authBar = document.getElementById('authStatus');

// ✅ Only use share ID from URL
const urlParams = new URLSearchParams(window.location.search);
const shareId = urlParams.get('share'); // ?share=...

if (!shareId) {
  alert('Invalid or missing share link.');
  window.location.href = '/';
}

// 2. Add a debug log to verify it's working
console.log("Current Share ID:", shareId);

if (!shareId || shareId === 'undefined') {
    console.error("No valid share ID found in URL.");
    // Optionally: window.location.href = '/'; 
}

async function loadSharedContent() {
    try {
        // Use the shareId captured above
        const response = await fetch(`/api/shares/${shareId}`);
        if (!response.ok) throw new Error('Share not found');

        const { poem, annotations, editable } = await response.json();

        renderPoem(poem.content);

        const banner = document.getElementById('sharingBanner');
        banner.textContent = editable ? 'Shared - Editable' : 'Shared - Read-Only';
        banner.className = editable ? 'banner edit-mode' : 'banner view-mode';

        initAnnotations({
            poemId: poem._id,
            annotations,
            readOnly: !editable
        });

    } catch (err) {
        console.error('Error loading shared content:', err);
        alert('Unable to load shared poem.');
    }
}

async function checkAuthStatus() {
    const authBar = document.getElementById('authStatus');
    if (!authBar) return;

    // 1. Define what we WANT to see
    const injectButtons = (userEmail = null) => {
        if (userEmail) {
            authBar.innerHTML = `
                <a href="/" class="auth-link">+ Add Poem</a>
                <a href="/dashboard.html" class="auth-link">Dashboard</a>
            `;
        } else {
            authBar.innerHTML = `
                <a href="/" class="auth-link">+ Add Poem</a>
                <a href="/login.html" class="auth-link">Login</a>
                <a href="/register.html" class="auth-link highlighted">Register</a>
            `;
        }
    };

    // 2. Perform the actual check
    try {
        const res = await fetch('/api/auth/user');
        const user = res.ok ? await res.json() : null;
        
        // 3. Inject our buttons
        injectButtons(user?.email);

        // TRIGGER TOAST LOGIC
        if (user && user.email) {
            const hasSeenToast = sessionStorage.getItem(`toast_${shareId}`);
            if (!hasSeenToast) {
                showToast();
                sessionStorage.setItem(`toast_${shareId}`, 'true');
            }
        }

        // 4. THE FIX: Watch for "Ghost" scripts trying to overwrite us
        const observer = new MutationObserver(() => {
            // If the HTML changes and doesn't contain our button, fix it.
            if (!authBar.innerHTML.includes('+ Add Poem')) {
                observer.disconnect(); // Prevent infinite loops
                injectButtons(user?.email);
                observer.observe(authBar, { childList: true });
            }
        });

        observer.observe(authBar, { childList: true });

    } catch (err) {
        injectButtons(null);
    }
}

function showToast() {
    const toast = document.getElementById('dashboard-toast');
    if (!toast) return;
    
    toast.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => { toast.style.display = 'none'; }, 500);
    }, 5000);
}

checkAuthStatus();

loadSharedContent();
