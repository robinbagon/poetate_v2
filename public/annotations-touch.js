// annotations-touch.js

import { saveAnnotation } from './saveAnnotation.js';
import { drawLine, redrawAllLines } from './lines.js';
import { makeEditable } from './editAnnotation.js';
import { deleteAnnotation } from './deleteAnnotation.js';
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

  await loadExistingAnnotations(poemId, readOnly);

  if (!readOnly) {
    let touchStartIndex = null;
    let selectedIndices = [];
    let isDragging = false;

    // Helper to add/remove temporary highlight class for visual feedback
    function updateTemporaryHighlight() {
        document.querySelectorAll('.poem-word').forEach(span => {
            span.classList.remove('temp-highlight');
        });
        selectedIndices.forEach(idx => {
            const span = poemContent.querySelector(`.poem-word[data-word-index="${idx}"]`);
            if (span) span.classList.add('temp-highlight');
        });
    }

    poemContent.addEventListener('touchstart', e => {
        if (e.touches.length > 1) return;

        const word = e.target.closest('.poem-word');
        if (!word) return;

        touchStartIndex = parseInt(word.dataset.wordIndex);
        selectedIndices = [touchStartIndex];
        isDragging = false;

        // Optional: start a short timer to detect long-press if desired
    });

    poemContent.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const word = element?.closest('.poem-word');
        if (!word) return;

        const index = parseInt(word.dataset.wordIndex);
        if (!selectedIndices.includes(index)) {
            selectedIndices.push(index);
            selectedIndices.sort((a, b) => a - b); // keep in order
            isDragging = true;
            updateTemporaryHighlight(); // live feedback
        }
    });

    poemContent.addEventListener('touchend', e => {
        if (!selectedIndices.length) return;

        // Commit the selection
        selectedSpanIndices = [...selectedIndices];

        const firstWord = poemContent.querySelector(`.poem-word[data-word-index="${selectedSpanIndices[0]}"]`);
        if (!firstWord) return;

        const rect = firstWord.getBoundingClientRect();
        annotationModal.style.display = 'block';
        annotationModal.style.position = 'absolute';
        annotationModal.style.top = `${rect.bottom + window.scrollY}px`;
        annotationModal.style.left = `${rect.left + window.scrollX}px`;

        // Focus keyboard for annotation input
        annotationText.focus();

        // Clean up temp highlights
        document.querySelectorAll('.poem-word').forEach(span => {
            span.classList.remove('temp-highlight');
        });

        // Reset state
        touchStartIndex = null;
        selectedIndices = [];
        isDragging = false;
    });
}


// Prevent native context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Create a floating "Annotate" button
const annotateButton = document.createElement('button');
annotateButton.innerText = 'Annotate';
annotateButton.style.position = 'absolute';
annotateButton.style.display = 'none';
annotateButton.style.zIndex = 9999;
annotateButton.style.padding = '5px 10px';
annotateButton.style.background = '#ffeb3b';
annotateButton.style.border = '1px solid #aaa';
annotateButton.style.borderRadius = '4px';
document.body.appendChild(annotateButton);

// Snapshot of selected spans for modal
let modalSelectedSpanIndices = [];

// Show the button when native selection occurs
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    annotateButton.style.display = 'none';
    selectedSpanIndices = [];
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
    annotateButton.style.top = `${rect.top - 40 + window.scrollY}px`;
    annotateButton.style.left = `${rect.left + window.scrollX}px`;
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
  if (!text || modalSelectedSpanIndices.length === 0) return;

  const highlightClass = getNextHighlightClass();
  const annotationId = 'ann-' + Math.random().toString(36).substr(2, 9);

  const annotationData = {
    _id: null, // will be set after saving
    annotationId,
    text,
    wordIndices: [...modalSelectedSpanIndices], // snapshot of selected words
    colorClass: highlightClass,
    timestamp: new Date().toISOString(),
    poemId: new URLSearchParams(window.location.search).get('poemId') || null
  };

  try {
    // Save to server
    const saved = await saveAnnotation(annotationData);
    annotationData._id = saved._id;
    annotationsMap.set(annotationData._id, annotationData);

    // Apply highlight to selected spans
    modalSelectedSpanIndices.forEach(index => {
      const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
      if (span) {
        span.dataset.annotationId = annotationData.annotationId;
        span.classList.add('highlight', highlightClass);
        span.dataset.annotationClass = highlightClass;
        span.title = annotationData.text;
      }
    });

    // Render the annotation box with full touch logic
    renderAnnotationBox(annotationData, readOnly, highlightClass);

    // Clear modal and reset selections
    annotationText.value = '';
    annotationModal.style.display = 'none';
    selectedSpanIndices = [];
    modalSelectedSpanIndices = [];



    // Emit new annotation via socket
    socket.emit('new-annotation', annotationData);

  } catch (err) {
    console.error('Failed to save annotation:', err);
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

  annotationBoxes.set(annotationData._id, { box, targetSpan, annotation: annotationData });

  if (annotationData.relativePosition) {
    const { dx, dy } = annotationData.relativePosition;
    const baseRect = targetSpan.getBoundingClientRect();
    box.style.left = `${baseRect.left + window.scrollX + dx}px`;
    box.style.top = `${baseRect.top + window.scrollY + dy}px`;
    box.style.position = 'absolute';
  } else {
    updateAnnotationBoxPosition(annotationData._id);
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
    e.preventDefault();

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    boxStartX = box.offsetLeft;
    boxStartY = box.offsetTop;
    isDragging = false;

    // Start long press timer
    pressTimer = setTimeout(async () => {
      if (!annotationData._id) return; // only delete saved annotations
      if (!confirm('Delete this annotation?')) return;

      const success = await deleteAnnotation(annotationData._id);
      if (!success) return;
      deleteAnnotationBox(annotationData._id);
      socket.emit('delete-annotation', { _id: annotationData._id });
    }, LONG_PRESS_DELAY);
  });

  box.addEventListener('touchmove', e => {
    if (startX === null) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // If moved beyond tolerance, cancel long press
    if (Math.sqrt(dx*dx + dy*dy) > MOVE_TOLERANCE) {
      clearTimeout(pressTimer);
      isDragging = true;
    }

    // Drag the box
    box.style.left = `${boxStartX + dx}px`;
    box.style.top = `${boxStartY + dy}px`;

    // Update connecting line if any
    const data = annotationBoxes.get(annotationData._id);
    if (data && data.line && data.line.isConnected) {
  const startRect = data.targetSpan.getBoundingClientRect();
  const endRect = box.getBoundingClientRect();
  const midX = (startRect.left + endRect.left + endRect.width) / 2;

  const d = `
    M ${startRect.left + startRect.width / 2 + window.scrollX},${startRect.top + startRect.height / 2 + window.scrollY}
    C ${startRect.left + startRect.width / 2 + 50},${startRect.top + startRect.height / 2 + window.scrollY}
      ${midX - 50},${endRect.top + endRect.height / 2 + window.scrollY}
      ${endRect.left + endRect.width / 2 + window.scrollX},${endRect.top + endRect.height / 2 + window.scrollY}
  `;

  data.line.setAttribute('d', d);
}

  });

  box.addEventListener('touchend', async e => {
    clearTimeout(pressTimer);

    // Update relative position
    if (startX !== null && annotationData._id) {
      const entry = annotationBoxes.get(annotationData._id);
      if (entry) {
        const spanRect = entry.targetSpan.getBoundingClientRect();
        annotationData.relativePosition = {
          dx: box.offsetLeft - spanRect.left - window.scrollX,
          dy: box.offsetTop - spanRect.top - window.scrollY
        };
        updateAnnotationPosition(annotationData);
      }
    }

    makeEditable(box, annotationData.annotationId, annotationData, (updatedText) => {
    // Update the box DOM without replacing the element
    box.textContent = updatedText;

    // Workaround: refresh the page to redraw lines
    window.location.reload();    
});


    // Reset state
    startX = null;
    startY = null;
    isDragging = false;
    lastTap = currentTime;
  });
}




  // Draw line
box.dataset.annotationId = annotationData._id;
  const line = drawLine(targetSpan, box, annotationData.annotationId);
  annotationBoxes.set(annotationData._id, { box, targetSpan, annotation: annotationData, line });
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
      annotationsMap.set(annotationData._id, annotationData);
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

async function updateAnnotationPosition(annotation) {
  try {
    await fetch(`/api/annotations/${annotation._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePosition: annotation.relativePosition })
    });
    socket.emit('update-annotation-position', {
      _id: annotation._id,
      relativePosition: annotation.relativePosition
    });
  } catch (err) {
    console.error('Error updating annotation position:', err);
  }
}

function setupSocketListeners() {
  socket.on('new-annotation', data => {
    if (!annotationsMap.has(data._id)) {
      annotationsMap.set(data._id, data);
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

  socket.on('delete-annotation', ({ _id }) => deleteAnnotationBox(_id));

  socket.on('update-annotation-position', data => {
    const boxData = annotationBoxes.get(data._id);
    if (!boxData) return;
    const { box, targetSpan, annotation, line } = boxData;
    annotation.relativePosition = data.relativePosition;

    const spanRect = targetSpan.getBoundingClientRect();
    const baseX = spanRect.left + window.scrollX;
    const baseY = spanRect.top + window.scrollY;

    box.style.left = `${baseX + data.relativePosition.dx}px`;
    box.style.top = `${baseY + data.relativePosition.dy}px`;

    if (line && line.parentNode) line.parentNode.removeChild(line);
    const newLine = drawLine(targetSpan, box, data._id);
    annotationBoxes.set(data._id, { ...boxData, line: newLine });
  });

  socket.on('update-annotation-text', ({ _id, newText }) => {
    const entry = annotationBoxes.get(_id);
    if (entry) {
      const { box, annotation } = entry;
      box.textContent = newText;
      annotation.text = newText;
    }
});
}


