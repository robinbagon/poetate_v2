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

    // Detect touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
