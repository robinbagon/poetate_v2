// share.js
import { renderPoem } from './renderPoem.js';
// ❌ REMOVED: import { initAnnotations } from './annotations.js'; 
// (We load this dynamically now)

const urlParams = new URLSearchParams(window.location.search);
const shareId = urlParams.get('share');

if (!shareId) {
    alert('Invalid or missing share link.');
    window.location.href = '/';
}

async function loadSharedContent() {
    try {
        const response = await fetch(`/api/shares/${shareId}`);
        if (!response.ok) throw new Error('Share not found');
        const { poem, annotations, editable } = await response.json();

        renderPoem(poem.content);

        // ✅ RESTORED: Update the Banner UI
        const bannerElement = document.getElementById('sharingBanner');
        if (bannerElement) {
            bannerElement.textContent = editable ? 'Shared - Editable' : 'Shared - Read-Only';
            bannerElement.className = `status-zone banner ${editable ? 'edit-mode' : 'view-mode'}`;
        }

        // ✅ TRAFFIC CONTROLLER
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        // Dynamically load the module
        const modulePath = isTouch ? './annotations-touch.js' : './annotations.js';
        const annotationModule = await import(modulePath);

        console.log(`System: Loading ${isTouch ? 'Touch' : 'Desktop'} logic`);

        // Initialize with the data from the server
        annotationModule.initAnnotations({
            poemId: poem._id,
            annotations: annotations, // Pass initial annotations
            readOnly: !editable
        });

    } catch (err) {
        console.error('Error loading shared content:', err);
        const bannerElement = document.getElementById('sharingBanner');
        if (bannerElement) bannerElement.textContent = 'Error loading shared poem';
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
