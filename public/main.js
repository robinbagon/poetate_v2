// main.js
import { renderPoem } from './renderPoem.js';
import { authUI } from './authUI.js'; //

async function loadPoemAndRender() {
    const urlParams = new URLSearchParams(window.location.search);
    const poemId = urlParams.get('poemId');

    authUI.init();

    if (!poemId) {
        console.error('No poem ID found in URL.');
        document.getElementById('poemContent').innerText = "Poem ID missing.";
        return;
    }

    try {
        // 1. Fetch Poem Data
        const response = await fetch(`/api/poems/${poemId}`);
        if (!response.ok) throw new Error(`Failed to fetch poem: ${response.statusText}`);

        const poem = await response.json();
        renderPoem(poem.content); 

        /// 2. Device Mode Logic
        const forcedMode = localStorage.getItem("forceMode");
        let isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        // Override auto-detection if a specific mode is forced
        if (forcedMode === "desktop") {
            isTouchDevice = false;
        } else if (forcedMode === "touch") {
            isTouchDevice = true;
        }

        // 3. Dynamic Module Loading
        const modulePath = isTouchDevice ? './annotations-touch.js' : './annotations.js';
        console.log(`Mode: ${forcedMode || 'auto'} | Loading: ${modulePath}`);


        
        try {
            const module = await import(modulePath);
            // Ensure the imported module has an initAnnotations function
            if (module.initAnnotations) {
                await module.initAnnotations({ poemId });
            }
        } catch (importErr) {
            console.error(`Failed to load module: ${modulePath}`, importErr);
        }

    } catch (error) {
        console.error('Error loading poem:', error.message);
    }
}

// Execute logic
loadPoemAndRender();

document.getElementById('addNewPoemHeader')?.addEventListener('click', () => {
    window.location.href = '/index.html';
});

// ============================================
// UI Switch Logic (Kept outside for DOM access)
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    const switchSelector = document.getElementById("switchSelector");
    const options = document.querySelectorAll(".mode-option");

    if (!switchSelector || !options.length) return;

    const setSwitchPosition = () => {
        const forced = localStorage.getItem("forceMode") || "auto";
        let index = 0;

        // Sync visual position and the 'active' class for text color
        options.forEach((opt, i) => {
            if (opt.dataset.mode === forced) {
                index = i;
                opt.classList.add("active");
            } else {
                opt.classList.remove("active");
            }
        });

        switchSelector.style.left = `calc((100% / 3) * ${index})`;
    };

    options.forEach(option => {
        option.addEventListener("click", () => {
            const mode = option.dataset.mode;
            
            // Highlight instantly for better perceived performance
            options.forEach(opt => opt.classList.remove("active"));
            option.classList.add("active");

            if (mode === "auto") {
                localStorage.removeItem("forceMode");
            } else {
                localStorage.setItem("forceMode", mode);
            }
            
            setSwitchPosition();
            
            // Short delay so the user sees the slider move before the reload
            setTimeout(() => location.reload(), 200);
        });
    });

    // Run on initial load
    setSwitchPosition();
});