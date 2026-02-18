// annotations-touch.js

import { drawLine, redrawAllLines } from './lines.js';
import { makeEditable } from './editAnnotation.js';
import { annotationService } from './annotationService.js';
import socket from './socket.js';

const annotationBoxes = new Map();
const annotationsMap = new Map();

let selectedSpanIndices = [];
let currentZIndex = 100;

let nextColorIndex = 0;
const maxColors = 8;

function getNextHighlightClass() {
  const highlightClass = `highlight-${nextColorIndex}`;
  nextColorIndex = (nextColorIndex + 1) % maxColors;
  return highlightClass;
}

export async function initAnnotations({ poemId = null, readOnly = false } = {}) {
  const poemContent = document.getElementById('poemContent');
  const annotationModal = document.getElementById('annotationModal');
  const annotationText = document.getElementById('annotationText');
  const saveAnnotationButton = document.getElementById('saveAnnotation');
  const cancelAnnotationButton = document.getElementById('cancelAnnotation');

  if (poemId) socket.emit('join-poem-room', poemId);
  await loadExistingAnnotations(poemId, readOnly);

// Create a floating "Annotate" button
const annotateButton = document.createElement('button');
annotateButton.innerText = 'Annotate';
annotateButton.className = 'annotate-floating-btn';
document.body.appendChild(annotateButton);

// Dismiss button when touching elsewhere
document.addEventListener('touchstart', (e) => {
    // If we touched the Annotate button, let it do its job (don't hide)
    if (e.target === annotateButton) return;

    // If we touched a poem word, the long-press/selection logic handles it
    if (e.target.closest('.poem-word')) return;

    // Otherwise, the user touched the background or another element
    annotateButton.style.display = 'none';
    selectedSpanIndices = [];
    
    // Optional: Clear the blue native selection highlight too
    window.getSelection().removeAllRanges();
});

// Snapshot of selected spans for modal
let modalSelectedSpanIndices = [];
let pressTimer;
const LONG_PRESS_DELAY = 500; 

  poemContent.addEventListener('touchstart', (e) => {
    const span = e.target.closest('.poem-word');
    if (!span || readOnly) return;

    // Clear any existing timer to avoid double-triggers
    clearTimeout(pressTimer);

    pressTimer = setTimeout(() => {
      // 1. Manually select the word for visual feedback
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(range);

      // 2. Update our tracking indices
      selectedSpanIndices = [parseInt(span.dataset.wordIndex)];

      // 3. Position and show the Annotate button
      const rect = span.getBoundingClientRect();
      annotateButton.style.top = `${rect.top - 50 + window.scrollY}px`; // Pop up above word
      annotateButton.style.left = `${rect.left + window.scrollX}px`;
      annotateButton.style.display = 'block';

      // Optional: Haptic feedback for "it worked"
      if (navigator.vibrate) navigator.vibrate(40);
    }, LONG_PRESS_DELAY);
  });

  // If the user moves their finger (scrolling) or lifts it, cancel the long-press
  poemContent.addEventListener('touchmove', () => clearTimeout(pressTimer));
  poemContent.addEventListener('touchend', () => clearTimeout(pressTimer));
  // --- NEW LONG PRESS LOGIC END ---

  // Keep your 'selectionchange' listener as a backup for when users 
  // drag the blue native selection handles:
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      // Don't hide the button immediately if it was just shown by long-press
      return; 
    }


  const range = selection.getRangeAt(0);
  const selectedSpans = Array.from(poemContent.querySelectorAll('.poem-word')).filter(span => {
    const spanRect = span.getBoundingClientRect();
    const selRects = Array.from(range.getClientRects());
    return selRects.some(selRect => {
      const overlapLeft = Math.max(spanRect.left, selRect.left);
      const overlapRight = Math.min(spanRect.right, selRect.right);
      const overlapWidth = Math.max(0, overlapRight - overlapLeft);
      const verticallyOverlaps = selRect.top < spanRect.bottom && selRect.bottom > spanRect.top;
      return overlapWidth / spanRect.width > 0.5 && verticallyOverlaps;
    });
  });

  if (selectedSpans.length > 0) {
    selectedSpanIndices = [...new Set(selectedSpans.map(span => parseInt(span.dataset.wordIndex)))];

    // Position the button near the selection
    const rect = range.getBoundingClientRect();
    annotateButton.style.top = `${rect.top + 40 + window.scrollY}px`;
    annotateButton.style.left = `${rect.right + window.scrollX + 10}px`;
    annotateButton.style.display = 'block';
  } else {
    annotateButton.style.display = 'none';
  }
});

// When the button is clicked, open the annotation modal
annotateButton.addEventListener('click', () => {
  if (selectedSpanIndices.length === 0) return;

  // Save snapshot for modal
  modalSelectedSpanIndices = [...selectedSpanIndices];

  const firstSpan = poemContent.querySelector(`.poem-word[data-word-index="${modalSelectedSpanIndices[0]}"]`);
  if (!firstSpan) return;

  const rect = firstSpan.getBoundingClientRect();
  annotationModal.style.display = 'block';
  annotationModal.style.position = 'absolute';
  annotationModal.style.top = `${rect.bottom + window.scrollY}px`;
  annotationModal.style.left = `${rect.left + window.scrollX}px`;

  annotationText.focus();
  annotateButton.style.display = 'none';
});


// Save annotation using the modal-level snapshot
saveAnnotationButton.addEventListener('click', async () => {
  if (readOnly) return;

  const text = annotationText.value.trim();
  // Use the modal snapshot we took when the "Annotate" button was clicked
  if (!text || modalSelectedSpanIndices.length === 0) return;

  const highlightClass = getNextHighlightClass();
  const annotationId = 'ann-' + Math.random().toString(36).substr(2, 9);

  const annotationData = {
    annotationId,
    text,
    wordIndices: [...modalSelectedSpanIndices],
    colorClass: highlightClass,
    poemId
  };

  try {
    // 1. Save to Database via Service
    const saved = await annotationService.save(annotationData);
    if (!saved || !saved._id) throw new Error('No _id returned');

    // 2. Attach the Database ID
    annotationData._id = saved._id;

    // 3. Update local UI
    annotationsMap.set(annotationData.annotationId, annotationData);
    modalSelectedSpanIndices.forEach(index => {
      const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
      if (span) {
        span.dataset.annotationId = annotationData.annotationId;
        span.classList.add('highlight', highlightClass);
      }
    });

    renderAnnotationBox(annotationData, readOnly, highlightClass);

    // 4. THE MISSING LINK: Broadcast to other devices
    socket.emit('new-annotation', annotationData);

    // 5. Cleanup
    annotationText.value = '';
    annotationModal.style.display = 'none';
    modalSelectedSpanIndices = [];
    selectedSpanIndices = [];

  } catch (err) {
    console.error('Failed to save and broadcast:', err);
    alert('Failed to save annotation.');
  }
});



  cancelAnnotationButton.addEventListener('click', () => {
    annotationText.value = '';
    annotationModal.style.display = 'none';
    selectedSpanIndices = [];
  });

  // Resize handling
  window.addEventListener('resize', () => {
    for (const [annotationId, { annotation, box, targetSpan }] of annotationBoxes.entries()) {
      if (annotation.relativePosition) {
        const { dx, dy } = annotation.relativePosition;
        const spanRect = targetSpan.getBoundingClientRect();
        const baseX = spanRect.left + window.scrollX;
        const baseY = spanRect.top + window.scrollY;
        box.style.left = `${baseX + dx}px`;
        box.style.top = `${baseY + dy}px`;
      } else {
        updateAnnotationBoxPosition(annotationId);
      }
      redrawAllLines(annotationBoxes);
    }
  });

  // near your existing window.addEventListener('resize', ...) block
window.addEventListener('scroll', () => {
  // If you store annotationBoxes keyed by annotationId (as you do), iterate them
  for (const [annotationId, { annotation, box, targetSpan }] of annotationBoxes.entries()) {
    if (!box || !targetSpan) continue;

    // If it has a relativePosition, recompute absolute box coords from the target span
    if (annotation && annotation.relativePosition) {
      const { dx, dy } = annotation.relativePosition;
      const spanRect = targetSpan.getBoundingClientRect();
      const baseX = spanRect.left + window.scrollX;
      const baseY = spanRect.top + window.scrollY;
      box.style.left = `${baseX + dx}px`;
      box.style.top  = `${baseY + dy}px`;
    } else {
      // otherwise compute where the box should sit relative to the poem
      updateAnnotationBoxPosition(annotationId);
    }
  }

  // Recalculate/redraw the SVG/paths for every annotation
  // Assumes your function redrawAllLines(annotationBoxes) recomputes using getBoundingClientRect()
  redrawAllLines(annotationBoxes);
}, { passive: true });


  // Load socket events
  setupSocketListeners();
}

// -------------------- BOX RENDERING --------------------

function renderAnnotationBox(annotationData, readOnly = false, highlightClass = null) {
  const lastIndex = annotationData.wordIndices[annotationData.wordIndices.length - 1];
  const targetSpan = document.querySelector(`.poem-word[data-word-index="${lastIndex}"]`);
  if (!targetSpan) return;

  const box = document.createElement('div');
  box.className = 'annotation-box';
  box.dataset.annotationId = annotationData.annotationId;
  box.textContent = annotationData.text;

  if (highlightClass) {
    box.classList.add(highlightClass);
    annotationData.colorClass = highlightClass;
  }

  document.body.appendChild(box);

  annotationBoxes.set(annotationData.annotationId, { box, targetSpan, annotation: annotationData });

  if (annotationData.relativePosition) {
    const { dx, dy } = annotationData.relativePosition;
    const baseRect = targetSpan.getBoundingClientRect();
    box.style.left = `${baseRect.left + window.scrollX + dx}px`;
    box.style.top = `${baseRect.top + window.scrollY + dy}px`;
    box.style.position = 'absolute';
  } else {
    updateAnnotationBoxPosition(annotationData.annotationId);
  }

  box.style.zIndex = currentZIndex++;

if (!readOnly) {
  // Touch drag and long-press logic
  let startX = null, startY = null, boxStartX = 0, boxStartY = 0;
  let pressTimer = null;
  let isDragging = false;
  const LONG_PRESS_DELAY = 600; // ms
  const MOVE_TOLERANCE = 15;   // pixels
  let lastTap = 0;

  box.addEventListener('touchstart', e => {
  if (e.touches.length > 1) return;
  
  startX = e.touches[0].pageX;
  startY = e.touches[0].pageY;
  boxStartX = box.offsetLeft;
  boxStartY = box.offsetTop;
  isDragging = false;

  pressTimer = setTimeout(async () => {
    // Only prevent default if we actually trigger the long-press delete
    e.preventDefault(); 
    if (!annotationData.annotationId) return;
    if (!confirm('Delete this annotation?')) return;

    const success = await annotationService.delete(
    annotationData._id, 
    annotationData.annotationId, 
    annotationData.poemId
);
    if (!success) return;

    deleteAnnotationBox(annotationData.annotationId);
    socket.emit('delete-annotation', { 
      _id: annotationData._id,
      annotationId: annotationData.annotationId,
      poemId: annotationData.poemId
    });
  }, LONG_PRESS_DELAY);
});

box.addEventListener('touchmove', e => {
  if (startX === null) return;

  if (e.cancelable) e.preventDefault();

  const dx = e.touches[0].pageX - startX;   // ✅ pageX/pageY
  const dy = e.touches[0].pageY - startY;

  // If moved beyond tolerance, cancel long press
  if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE) {
    clearTimeout(pressTimer);
    isDragging = true;
  }

  // Drag the box visually
  box.style.left = `${boxStartX + dx}px`;
  box.style.top  = `${boxStartY + dy}px`;

  // Update the connecting line
  const data = annotationBoxes.get(annotationData.annotationId);
  if (data) {
    if (data.line && data.line.parentNode) {
      data.line.parentNode.removeChild(data.line); // remove old line
    }
    const newLine = drawLine(data.targetSpan, box, annotationData.annotationId);
    annotationBoxes.set(annotationData.annotationId, { ...data, line: newLine });
  }

}, { passive: false });


box.addEventListener('touchend', async e => {
  clearTimeout(pressTimer);

  // Update relative position
  if (startX !== null && annotationData.annotationId) {
    const entry = annotationBoxes.get(annotationData.annotationId);
    if (entry) {
      const spanRect = entry.targetSpan.getBoundingClientRect();
      annotationData.relativePosition = {
        dx: box.offsetLeft - (spanRect.left + window.scrollX),
        dy: box.offsetTop - (spanRect.top + window.scrollY)
      };
      annotationService.updatePosition(annotationData);
    }
  }

  makeEditable(box, annotationData.annotationId, annotationData, (updatedText) => {
    box.textContent = updatedText;

    const entry = annotationBoxes.get(annotationData.annotationId);
    if (entry) entry.annotation.text = updatedText;

    if (entry && entry.line && entry.line.parentNode) {
      entry.line.parentNode.removeChild(entry.line);
    }
    const newLine = drawLine(entry.targetSpan, box, annotationData.annotationId);
    annotationBoxes.set(annotationData.annotationId, { ...entry, line: newLine });

    redrawAllLines(annotationBoxes);
  });

  startX = null;
  startY = null;
  isDragging = false;
});

}




  // Draw line
box.dataset.annotationId = annotationData.annotationId;
  const line = drawLine(targetSpan, box, annotationData.annotationId);
  annotationBoxes.set(annotationData.annotationId, { box, targetSpan, annotation: annotationData, line });

}

// -------------------- HELPER FUNCTIONS --------------------

function updateAnnotationBoxPosition(annotationId) {
  const entry = annotationBoxes.get(annotationId);
  if (!entry) return;
  const { box, targetSpan } = entry;
  const poemContent = document.getElementById('poemContent');
  const poemRect = poemContent.getBoundingClientRect();
  const spanRect = targetSpan.getBoundingClientRect();

  box.style.position = 'absolute';
  const sidePadding = 20;
  const boxWidth = box.offsetWidth;
  const x = poemRect.right + sidePadding;
  const y = spanRect.top + window.scrollY;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}

// Delete annotation box & cleanup
function deleteAnnotationBox(annotationId) {
  const boxData = annotationBoxes.get(annotationId);
  if (!boxData) return;
  const { box, line, annotation } = boxData;

  annotation.wordIndices.forEach(index => {
    const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
    if (!span) return;
    if (annotation.colorClass) span.classList.remove(annotation.colorClass);
    delete span.dataset.annotationId;
    delete span.dataset.annotationClass;
    span.removeAttribute('title');
  });

  if (box) box.remove();
  if (line) {
  if (line.remove) {
    line.remove();
  } else if (line.parentNode) {
    line.parentNode.removeChild(line);
  }
}
  annotationBoxes.delete(annotationId);
  annotationsMap.delete(annotationId);
}

async function loadExistingAnnotations(poemId = null, readOnly = false) {
  if (!poemId) poemId = new URLSearchParams(window.location.search).get('poemId');
  if (!poemId) return;

  try {
    const response = await fetch(`/api/annotations/${poemId}`);
    if (!response.ok) throw new Error('Failed to fetch annotations');
    const annotations = await response.json();

    for (const annotationData of annotations) {
      annotationsMap.set(annotationData.annotationId, annotationData);
      const highlightClass = getNextHighlightClass();
      annotationData.colorClass = highlightClass;
      annotationData.wordIndices.forEach(index => {
        const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
        if (span) {
          span.dataset.annotationId = annotationData.annotationId;
          span.classList.add('highlight', highlightClass);
          span.dataset.annotationClass = highlightClass;
          span.title = annotationData.text;
        }
      });
      renderAnnotationBox(annotationData, readOnly, highlightClass);
    }
  } catch (err) {
    console.error('Error loading annotations:', err);
  }
}

// -------------------- HELPER: resize SVG layer --------------------
function resizeSvgLayer() {
  const svg = document.getElementById('annotation-lines');
  if (svg) {
    svg.setAttribute('width', document.documentElement.scrollWidth);
    svg.setAttribute('height', document.documentElement.scrollHeight);
  }
}

// Run once at start
document.addEventListener('DOMContentLoaded', resizeSvgLayer);

// Keep it in sync on resize/scroll
window.addEventListener('resize', resizeSvgLayer);
window.addEventListener('scroll', resizeSvgLayer);

function setupSocketListeners() {
  socket.on('new-annotation', data => {
    if (!annotationsMap.has(data.annotationId)) {
      annotationsMap.set(data.annotationId, data);
      renderAnnotationBox(data, false, data.colorClass);

      data.wordIndices.forEach(index => {
      const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
      if (span) {
        span.dataset.annotationId = data.annotationId;
        span.dataset.highlightCount = parseInt(span.dataset.highlightCount || '0', 10) + 1;
        span.classList.add('highlight', data.colorClass); // ✅ use same logic
        span.dataset.annotationClass = data.colorClass;
        span.title = `Highlighted ${span.dataset.highlightCount} time${span.dataset.highlightCount > 1 ? 's' : ''}`;
      }
    });

    addHoverListenersForAnnotation(data.annotationId);
    }
  });

  socket.on('delete-annotation', ({ annotationId }) => deleteAnnotationBox(annotationId));

  socket.on('update-annotation-position', data => {
    const boxData = annotationBoxes.get(data.annotationId);
    if (!boxData) return;
    const { box, targetSpan, annotation, line } = boxData;
    annotation.relativePosition = data.relativePosition;

    const spanRect = targetSpan.getBoundingClientRect();
    const baseX = spanRect.left + window.scrollX;
    const baseY = spanRect.top + window.scrollY;

    box.style.left = `${baseX + data.relativePosition.dx}px`;
    box.style.top = `${baseY + data.relativePosition.dy}px`;

    if (line && line.parentNode) line.parentNode.removeChild(line);
    const newLine = drawLine(targetSpan, box, data.annotationId);
    annotationBoxes.set(data.annotationId, { ...boxData, line: newLine });
  });

  socket.on('update-annotation-text', ({ annotationId, newText }) => {
    const entry = annotationBoxes.get(annotationId);
    if (entry) {
      const { box, annotation } = entry;
      box.textContent = newText;
      annotation.text = newText;
    }
});
}



