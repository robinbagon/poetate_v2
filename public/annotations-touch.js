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
annotateButton.style.display = 'none';
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

// --- SELECTION STATE ---
let modalSelectedSpanIndices = [];
let pressTimer;
const LONG_PRESS_DELAY = 500; 

// 1. Helper to update visual selection feedback
function updateManualSelectionUI() {
    document.querySelectorAll('.poem-word').forEach(word => {
        word.classList.remove('is-selecting');
    });
    selectedSpanIndices.forEach(index => {
        const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
        if (span) span.classList.add('is-selecting');
    });
}

// 2. Touch Start: Handles Long-press (Start) and Taps (Build)
poemContent.addEventListener('touchstart', (e) => {
    const span = e.target.closest('.poem-word');
    if (!span || readOnly) return;

    // If we are already selecting, every tap adds/removes words
    if (selectedSpanIndices.length > 0) {
        const index = parseInt(span.dataset.wordIndex);
        
        if (selectedSpanIndices.includes(index)) {
            selectedSpanIndices = selectedSpanIndices.filter(i => i !== index);
        } else {
            selectedSpanIndices.push(index);
        }
        
        selectedSpanIndices.sort((a, b) => a - b);
        updateManualSelectionUI();
        
        const rect = span.getBoundingClientRect();
        annotateButton.style.top = `${rect.top - 60 + window.scrollY}px`;
        annotateButton.style.left = `${rect.left + window.scrollX}px`;
        annotateButton.style.display = selectedSpanIndices.length > 0 ? 'block' : 'none';
        return; 
    }

    // Start long-press timer for initial selection
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        const index = parseInt(span.dataset.wordIndex);
        selectedSpanIndices = [index];
        updateManualSelectionUI();

        const rect = span.getBoundingClientRect();
        annotateButton.style.top = `${rect.top - 60 + window.scrollY}px`; 
        annotateButton.style.left = `${rect.left + window.scrollX}px`;
        annotateButton.style.display = 'block';

        if (navigator.vibrate) navigator.vibrate(40);
    }, LONG_PRESS_DELAY);
});

// 3. Movement/End listeners to manage the timer
poemContent.addEventListener('touchmove', () => clearTimeout(pressTimer));
poemContent.addEventListener('touchend', () => clearTimeout(pressTimer));

// 4. Floating Annotate Button Click
annotateButton.addEventListener('click', () => {
    if (selectedSpanIndices.length === 0) return;

    modalSelectedSpanIndices = [...selectedSpanIndices];

    const firstSpan = poemContent.querySelector(`.poem-word[data-word-index="${modalSelectedSpanIndices[0]}"]`);
    if (!firstSpan) return;

    const deleteBtn = document.getElementById('deleteAnnotation');
    if (deleteBtn) {
        deleteBtn.style.display = 'none'; // ❌ Hide for new annotations
    }

    const rect = firstSpan.getBoundingClientRect();
    annotationModal.style.display = 'block';
    annotationModal.style.position = 'absolute';
    annotationModal.style.top = `${rect.bottom + window.scrollY}px`;
    annotationModal.style.left = `${rect.left + window.scrollX}px`;

    annotationText.focus();
    annotateButton.style.display = 'none';
});


const deleteAnnotationButton = document.getElementById('deleteAnnotation');

deleteAnnotationButton.addEventListener('click', async () => {
    const editingId = annotationModal.dataset.editingId;
    if (!editingId) return;

    const annotationData = annotationsMap.get(editingId);
    if (!annotationData) return;

    // 🚀 Removed 'confirm()' to prevent virtual keyboard glitches
    try {
        const success = await annotationService.delete(
            annotationData._id, 
            editingId, 
            poemId
        );

        if (success) {
            deleteAnnotationBox(editingId);
            
            socket.emit('delete-annotation', { 
                _id: annotationData._id,
                annotationId: editingId, 
                poemId: poemId 
            });

            // Close modal and cleanup
            annotationModal.style.display = 'none';
            delete annotationModal.dataset.editingId;
            annotationText.value = '';

            // 🎯 CRITICAL: If the keyboard is still open, this helps 
            // the browser "reset" the scroll position.
            window.scrollTo(window.scrollX, window.scrollY);
        }
    } catch (err) {
        console.error('Delete failed:', err);
        // Note: Even alert() can cause keyboard issues, 
        // consider a custom 'Toast' instead.
        alert('Could not delete annotation.');
    }
});


// Save annotation using the modal-level snapshot
saveAnnotationButton.addEventListener('click', async () => {
    if (readOnly) return;
    const text = annotationText.value.trim();
    if (!text) return;

    // 1. Get the ID the modal is currently editing
    const editingId = annotationModal.dataset.editingId;

    if (editingId) {
        // --- UPDATE EXISTING ANNOTATION ---
        const annotationData = annotationsMap.get(editingId);

        if (annotationData) {
            try {
                // Use the service to update the database
                const success = await annotationService.updateText(
                    annotationData._id, 
                    text, 
                    editingId, 
                    poemId
                );

                if (success) {
                    // Update the local Map object
                    annotationData.text = text;

                    // Update the Box UI
                    const entry = annotationBoxes.get(editingId);
                    if (entry) {
                        entry.box.textContent = text;
                        entry.annotation.text = text; 
                    }

                    // Update hover titles/attributes on poem words
                    annotationData.wordIndices.forEach(index => {
                        const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
                        if (span) span.title = text;
                    });

                    console.log("Update successful for:", editingId);
                }
            } catch (err) {
                console.error('Update failed:', err);
            }
        }
    } else if (modalSelectedSpanIndices.length > 0) {
        // --- CREATE NEW ANNOTATION ---
        
        // Helper to generate a unique UI ID if generateAnnotationId() isn't global
        const annotationId = `ann-${Math.random().toString(36).substr(2, 9)}`;
        const highlightClass = getNextHighlightClass();

        // Construct the highlight text from the spans
        const highlightText = modalSelectedSpanIndices.map(index => {
            const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
            return span ? span.textContent : '';
        }).join(' ');

        const annotationData = {
            annotationId,
            text,
            highlight: highlightText,
            wordIndices: [...modalSelectedSpanIndices], // Matches renderAnnotationBox expectation
            colorClass: highlightClass,
            poemId
        };

        try {
            // Save to DB via service
            const saved = await annotationService.save(annotationData);
            
            if (saved) {
                // Update local data with the DB-generated _id
                annotationData._id = saved._id;
                annotationsMap.set(annotationId, annotationData);

                // Apply visual highlights to poem text
                modalSelectedSpanIndices.forEach(index => {
                    const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
                    if (span) {
                        span.dataset.annotationId = annotationId;
                        span.classList.add('highlight', highlightClass);
                        span.title = text;
                    }
                });

                // Create the physical annotation box and line
                renderAnnotationBox(annotationData, readOnly, highlightClass);
                
                // Redraw all lines to ensure connections are correct
                if (typeof redrawAllLines === 'function') {
                    redrawAllLines(annotationBoxes);
                }
            }
        } catch (err) {
            console.error('Failed to save:', err);
            alert('Could not save annotation.');
        }
    }

    // --- CLEANUP ---
    annotationText.value = '';
    annotationModal.style.display = 'none';
    delete annotationModal.dataset.editingId;

        // Remove the custom "painting" highlights from the UI
    document.querySelectorAll('.poem-word.is-selecting').forEach(word => {
        word.classList.remove('is-selecting');
    });

    // Reset the tracking arrays
    modalSelectedSpanIndices = [];
    selectedSpanIndices = []; 

    // Hide the floating annotate button if it's still hanging around
    const annotateButton = document.querySelector('.annotate-floating-btn');
    if (annotateButton) annotateButton.style.display = 'none';
});


  cancelAnnotationButton.addEventListener('click', () => {
    annotationText.value = '';
    annotationModal.style.display = 'none';
    delete annotationModal.dataset.editingId;

    // 🎯 RESET THE DELETE BUTTON
    const deleteBtn = document.getElementById('deleteAnnotation');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }

    // Wipe visual highlights
    document.querySelectorAll('.poem-word.is-selecting').forEach(word => {
        word.classList.remove('is-selecting');
    });

    // Reset selection state
    selectedSpanIndices = [];
    modalSelectedSpanIndices = [];
});

  // Resize handling
  window.addEventListener('resize', () => {
    // 1. Prepare the SVG Layer
    const svg = document.getElementById('annotation-lines');
    if (svg) {
        svg.setAttribute('width', document.documentElement.scrollWidth);
        svg.setAttribute('height', document.documentElement.scrollHeight);
    }

    for (const [id, data] of annotationBoxes.entries()) {
        const { annotation, box, targetSpan } = data;
        if (!box || !targetSpan) continue;

        
        box.style.animation = 'none';
        box.style.transition = 'none';

        if (annotation.relativePosition) {
            const { dx, dy } = annotation.relativePosition;
            const spanRect = targetSpan.getBoundingClientRect();
            
            // Calculate new position instantly
            const newLeft = spanRect.left + window.scrollX + dx;
            const newTop  = spanRect.top + window.scrollY + dy;
            
            box.style.left = `${newLeft}px`;
            box.style.top  = `${newTop}px`;
        } else {
            updateAnnotationBoxPosition(id);
        }

        setTimeout(() => {
            drawLine(targetSpan, box, id);
            
            
            box.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease';
        }, 0);
    }
});

  
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

  // Force reflow for height calculation
  const boxHeight = box.offsetHeight;

  // Store in map BEFORE positioning logic
  annotationBoxes.set(annotationData.annotationId, { box, targetSpan, annotation: annotationData });

  if (annotationData.relativePosition) {
    const { dx, dy } = annotationData.relativePosition;
    const baseRect = targetSpan.getBoundingClientRect();
    box.style.left = `${baseRect.left + window.scrollX + dx}px`;
    box.style.top = `${baseRect.top + window.scrollY + dy}px`;
    box.style.position = 'absolute';
  } else {
    // 1. Calculate smart position
    updateAnnotationBoxPosition(annotationData.annotationId);

    // 2. CAPTURE AND SAVE: If this is the first time rendering (no relativePosition yet)
    if (!readOnly) {
      const spanRect = targetSpan.getBoundingClientRect();
      
      annotationData.relativePosition = {
        dx: box.offsetLeft - (spanRect.left + window.scrollX),
        dy: box.offsetTop - (spanRect.top + window.scrollY)
      };

      // Persist the smart-calculated position to the DB
      annotationService.updatePosition(annotationData);
    }
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
    
    // Add dragging class immediately to kill CSS transitions
    box.classList.add('dragging');

    startX = e.touches[0].pageX;
    startY = e.touches[0].pageY;
    boxStartX = box.offsetLeft;
    boxStartY = box.offsetTop;
    isDragging = false;

    // 🚀 LONG PRESS DELETE REMOVED FROM HERE
});

box.addEventListener('touchmove', e => {
    if (startX === null) return;
    if (e.cancelable) e.preventDefault();

    const dx = e.touches[0].pageX - startX;
    const dy = e.touches[0].pageY - startY;

    // If moved beyond tolerance, flag as dragging
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE) {
        isDragging = true;
    }

    window.requestAnimationFrame(() => {
        if (startX === null) return; 
        
        box.style.left = `${boxStartX + dx}px`;
        box.style.top  = `${boxStartY + dy}px`;

        const data = annotationBoxes.get(annotationData.annotationId);
        if (data) {
            if (data.line && data.line.parentNode) {
                data.line.parentNode.removeChild(data.line);
            }
            const newLine = drawLine(data.targetSpan, box, annotationData.annotationId);
            annotationBoxes.set(annotationData.annotationId, { ...data, line: newLine });
        }
    });
}, { passive: false });

box.addEventListener('touchend', async e => {
    box.classList.remove('dragging');

    // Prevent error if startX wasn't set (e.g. multi-touch glitches)
    if (startX === null) return;

    const endX = e.changedTouches[0].pageX;
    const endY = e.changedTouches[0].pageY;
    const moveDistance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

    // 1. Handle TAP (Open Modal)
    if (!isDragging && moveDistance < MOVE_TOLERANCE) {
        const modal = document.getElementById('annotationModal');
        const textarea = document.getElementById('annotationText');
        
        // 🎯 FIX 1: Define the delete button
        const deleteBtn = document.getElementById('deleteAnnotation');

        modal.dataset.editingId = annotationData.annotationId;
        textarea.value = annotationData.text;

        if (deleteBtn) {
            // 🎯 FIX 2: Use 'readOnly' (from function args) not 'isReadOnly'
            deleteBtn.style.display = readOnly ? 'none' : 'block';
        }

        modal.style.display = 'block';
        modal.style.position = 'absolute';
        
        const rect = box.getBoundingClientRect();
        modal.style.top = `${rect.top + window.scrollY}px`;
        modal.style.left = `${rect.left + window.scrollX}px`;

        textarea.focus();
        
        const annotateBtn = document.querySelector('.annotate-floating-btn');
        if (annotateBtn) annotateBtn.style.display = 'none';
    }
    
    // 2. Handle DRAG END
    else if (startX !== null && isDragging) {
        const entry = annotationBoxes.get(annotationData.annotationId);
        if (entry) {
            const spanRect = entry.targetSpan.getBoundingClientRect();
            annotationData.relativePosition = {
                dx: box.offsetLeft - (spanRect.left + window.scrollX),
                dy: box.offsetTop - (spanRect.top + window.scrollY)
            };
            
            annotationService.updatePosition(annotationData);
            
            socket.emit('update-annotation-position', {
                annotationId: annotationData.annotationId,
                relativePosition: annotationData.relativePosition,
                poemId: annotationData.poemId
            });
        }
    }

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
    if (!poemContent) return;

    const poemRect = poemContent.getBoundingClientRect();
    const spanRect = targetSpan.getBoundingClientRect();
    
    // Standardize to Document-relative coordinates
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    const sidePadding = 20;
    const verticalSpacing = 10;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    box.style.position = 'absolute';

    // 1. Horizontal Positioning: Default to the right of the poem
    // We use scrollX to ensure it's placed correctly regardless of horizontal scroll
    let x = poemRect.right + scrollX + sidePadding;

    // iPad Check: If the box is being pushed off the right edge of the screen, 
    // shift it left so it's at least visible.
    const rightEdge = x + boxWidth;
    if (rightEdge > window.innerWidth + scrollX) {
        x = Math.max(scrollX + 10, (window.innerWidth + scrollX) - boxWidth - 10);
    }

    // 2. Initial Vertical Positioning (Document-relative)
    let y = spanRect.top + scrollY;

    // 3. Collision Loop: Check against all other existing boxes
    let collision = true;
    let safetyCounter = 0;

    while (collision && safetyCounter < 50) {
        collision = false;
        safetyCounter++;

        for (const [id, other] of annotationBoxes.entries()) {
            if (id === annotationId) continue;

            const otherBox = other.box;
            const otherRect = otherBox.getBoundingClientRect();
            
            // Convert 'other' box to Document-relative
            const otherTop = otherRect.top + scrollY;
            const otherBottom = otherTop + otherBox.offsetHeight;
            const otherLeft = otherRect.left + scrollX;
            const otherRight = otherLeft + otherBox.offsetWidth;

            // Overlap detection
            if (
                x < otherRight &&
                x + boxWidth > otherLeft &&
                y < otherBottom &&
                y + boxHeight > otherTop
            ) {
                // Move down below the box we hit
                y = otherBottom + verticalSpacing;
                collision = true;
                break; // Exit for-loop to re-check against everyone from the new Y
            }
        }
    }

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
    if (data.senderId === socket.id) return;
    const boxData = annotationBoxes.get(data.annotationId);
    if (!boxData) return;

    const { box, targetSpan, annotation } = boxData;
    annotation.relativePosition = data.relativePosition;

    // 1. TEMPORARILY STRIP ANIMATIONS
    // This stops the 'boxAppear' or any transitions from "lagging" the position
    box.style.animation = 'none';
    box.style.transition = 'none';

    const spanRect = targetSpan.getBoundingClientRect();
    
    // 2. Set the new position
    const newLeft = spanRect.left + window.scrollX + data.relativePosition.dx;
    const newTop  = spanRect.top + window.scrollY + data.relativePosition.dy;
    
    box.style.left = `${newLeft}px`;
    box.style.top  = `${newTop}px`;

    // 3. THE "INSTANT SYNC": Use the values we JUST calculated
    // instead of asking the browser where the box is.
    // We pass the numbers directly to a modified drawLine call or use a timeout.
    setTimeout(() => {
        drawLine(targetSpan, box, data.annotationId);
        
        // 4. RESTORE CSS (Optional)
        // Put the transitions back after the line is drawn
        box.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease';
    }, 0); 
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



