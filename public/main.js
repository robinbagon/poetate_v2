// main.js
import { renderPoem } from './renderPoem.js';

async function loadPoemAndRender() {
  const urlParams = new URLSearchParams(window.location.search);
  const poemId = urlParams.get('poemId');

  if (!poemId) {
    console.error('No poem ID found in URL.');
    return;
  }

  try {
    const response = await fetch(`/api/poems/${poemId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch poem: ${response.statusText}`);
    }

    const poem = await response.json();
    renderPoem(poem.content); // Render the poem first

    // ------------------------------
    // DEVICE MODE SELECTION LOGIC
    // ------------------------------

    // 1. Check if user has forced desktop/touch mode
    const forcedMode = localStorage.getItem("forceMode");

    // 2. Default automatic detection
    let isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // 3. Apply override if present
    if (forcedMode === "desktop") isTouchDevice = false;
    if (forcedMode === "touch") isTouchDevice = true;

    // 4. Load appropriate module
    if (isTouchDevice) {
      const module = await import('./annotations-touch.js');
      await module.initAnnotations({ poemId });
    } else {
      const module = await import('./annotations.js');
      await module.initAnnotations({ poemId });
    }

  } catch (error) {
    console.error('Error loading poem:', error.message);
  }
}

// Run on page load
loadPoemAndRender();


// ============================================
// DEVICE MODE TOGGLE BUTTON
// ============================================

// ===== THREE-WAY MODE SWITCH =====
document.addEventListener("DOMContentLoaded", () => {
  const switchSelector = document.getElementById("switchSelector");
  const options = document.querySelectorAll("#modeSwitch .option");

  if (!switchSelector || !options.length) return;

  const setSwitchPosition = () => {
    const forced = localStorage.getItem("forceMode");

    let index = 0; // Auto
    if (forced === "desktop") index = 1;
    if (forced === "touch") index = 2;

    switchSelector.style.left = `calc((240px / 3) * ${index})`;
  };

  options.forEach(option => {
    option.addEventListener("click", () => {
      const mode = option.dataset.mode;

      if (mode === "auto") {
        localStorage.removeItem("forceMode");
      } else {
        localStorage.setItem("forceMode", mode);
      }

      setSwitchPosition();

      setTimeout(() => location.reload(), 150);
    });
  });

  setSwitchPosition();
});
