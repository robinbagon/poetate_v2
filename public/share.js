// share.js

import { renderPoem } from './renderPoem.js';
import { initAnnotations } from './annotations.js';

const poemContentDiv = document.getElementById('poemContent');
const banner = document.getElementById('sharingBanner');

// ✅ Only use share ID from URL
const urlParams = new URLSearchParams(window.location.search);
const shareId = urlParams.get('share'); // ?share=...

if (!shareId) {
  alert('Invalid or missing share link.');
  window.location.href = '/';
}

async function loadSharedContent() {
  try {
    const response = await fetch(`/api/poems/shared/${shareId}`);
    if (!response.ok) throw new Error('Share not found');

    const { poem, annotations, editable } = await response.json(); // <- backend decides access

    // Render poem
    renderPoem(poem.content);

    // Set banner
    banner.textContent = editable ? 'Editable Version' : 'Read-Only Version';
    banner.className = editable ? 'edit-mode' : 'view-mode';

    // Secure: use editable flag from server only
    initAnnotations({
      poemId: poem._id,
      annotations,
      readOnly: !editable
    });

  } catch (err) {
    console.error('Error loading shared content:', err);
    alert('Unable to load shared poem.');
    window.location.href = '/';
  }
}

loadSharedContent();
