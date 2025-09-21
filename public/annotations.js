// annotations.js

import { saveAnnotation } from './saveAnnotation.js';
import { drawLine, redrawAllLines } from './lines.js';
import { makeEditable } from './editAnnotation.js';
import { deleteAnnotation } from './deleteAnnotation.js';
import socket from './socket.js';

const annotationBoxes = new Map();
const annotationsMap = new Map();

let selectedSpanIndices = [];
let currentZIndex = 100; // start high enough to always be above page content

let nextColorIndex = 0;
const maxColors = 8; // matches the number of CSS highlight classes

function getNextHighlightClass() {
  const highlightClass = `highlight-${nextColorIndex}`;
  nextColorIndex = (nextColorIndex + 1) % maxColors;
  return highlightClass;
}

document.addEventListener('DOMContentLoaded', async () => {
  const authStatus = document.getElementById('authStatus');

  try {
    const response = await fetch('/api/auth/user', { credentials: 'include' });
    if (response.ok) {
      const user = await response.json();
      authStatus.innerHTML = `
        <span>Welcome, ${user.email}</span>
        <button id="dashboardBtn">Dashboard</button>
        <button id="logoutBtn">Logout</button>
      `;

      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.reload();
      });

      document.getElementById('dashboardBtn').addEventListener('click', () => {
        window.location.href = '/dashboard.html';
      });
    } else {
      setupLoginRegister();
    }
  } catch (err) {
    console.error('Error checking auth status:', err);
    setupLoginRegister();
  }
});

function setupLoginRegister() {
  const authStatus = document.getElementById('authStatus');
  authStatus.innerHTML = `
    <button id="loginBtn">Login</button>
    <button id="registerBtn">Register</button>
  `;
  document.getElementById('loginBtn').addEventListener('click', () => window.location.href = '/login.html');
  document.getElementById('registerBtn').addEventListener('click', () => window.location.href = '/register.html');
}

export async function initAnnotations({ poemId = null, readOnly = false } = {}) {
  const poemContent = document.getElementById('poemContent');
  const annotationModal = document.getElementById('annotationModal');
  const annotationText = document.getElementById('annotationText');
  const saveAnnotationButton = document.getElementById('saveAnnotation');
  const cancelAnnotationButton = document.getElementById('cancelAnnotation');

  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const registerBtn = document.getElementById('registerBtn');

  if (loginBtn) loginBtn.addEventListener('click', () => window.location.href = '/login.html');
  if (registerBtn) registerBtn.addEventListener('click', () => window.location.href = '/register.html');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => { await fetch('/api/auth/logout'); window.location.reload(); });

  await loadExistingAnnotations(poemId, readOnly);

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
    }
    redrawAllLines(annotationBoxes);
  });

  if (!readOnly) {
    poemContent.addEventListener('mouseup', () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !poemContent.contains(selection.anchorNode)) return;
      const range = selection.getRangeAt(0);
      const selRects = Array.from(range.getClientRects());

      const selectedSpans = Array.from(poemContent.querySelectorAll('.poem-word')).filter(span => {
        const spanRect = span.getBoundingClientRect();
        return selRects.some(selRect => {
          const overlapLeft = Math.max(spanRect.left, selRect.left);
          const overlapRight = Math.min(spanRect.right, selRect.right);
          const overlapWidth = Math.max(0, overlapRight - overlapLeft);
          const overlapRatio = overlapWidth / spanRect.width;
          const verticallyOverlaps = selRect.top < spanRect.bottom && selRect.bottom > spanRect.top;
          return overlapRatio > 0.5 && verticallyOverlaps;
        });
      });

      if (selectedSpans.length > 0) {
        selectedSpanIndices = [...new Set(selectedSpans.map(span => span.dataset.wordIndex))];
        const rect = range.getBoundingClientRect();
        annotationModal.style.display = 'block';
        annotationModal.style.position = 'absolute';
        annotationModal.style.top = `${rect.bottom + window.scrollY}px`;
        annotationModal.style.left = `${rect.left + window.scrollX}px`;
      }
    });
  }

  saveAnnotationButton.addEventListener('click', async () => {
    if (readOnly) return;

    const text = annotationText.value.trim();
    if (text && selectedSpanIndices.length > 0) {
        const highlightClass = getNextHighlightClass(); // pick CSS class
        const annotationId = generateAnnotationId();

        const highlight = selectedSpanIndices.map(index => {
            const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
            return span ? span.textContent : '';
        }).join(' ');

        const annotationData = {
            _id: null, // will be set after saving
            annotationId,
            text,
            highlight,
            wordIndices: selectedSpanIndices,
            colorClass: highlightClass, // store class
            timestamp: new Date().toISOString(),
            poemId: new URLSearchParams(window.location.search).get('poemId') || null
        };

        try {
            const saved = await saveAnnotation(annotationData);
            if (saved && saved._id) {
                annotationData._id = saved._id;
            } else {
                throw new Error('No _id returned from server');
            }

            annotationsMap.set(annotationData._id, annotationData);

            // Apply CSS class to all words
            selectedSpanIndices.forEach(index => {
                const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
                if (span) {
                    span.dataset.annotationId = annotationData.annotationId;
                    span.classList.add('highlight', highlightClass);
                    span.dataset.annotationClass = highlightClass; // for cleanup
                    span.title = annotationData.text;
                }
            });

            // Render annotation box with CSS class
            renderAnnotationBox(annotationData, readOnly, highlightClass);

            addHoverListenersForAnnotation(annotationData.annotationId);

            // Emit new annotation
            socket.emit('new-annotation', annotationData);

            annotationText.value = '';
            annotationModal.style.display = 'none';
            selectedSpanIndices = [];

        } catch (err) {
            console.error('Failed to save annotation:', err);
            alert('Failed to save annotation.');
        }
    }
});


  cancelAnnotationButton.addEventListener('click', () => {
    annotationText.value = '';
    annotationModal.style.display = 'none';
    selectedSpanIndices = [];
  });

  // Socket events
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

socket.on('delete-annotation', ({ _id }) => {
    const boxData = annotationBoxes.get(_id);
    if (!boxData) return;
    const { box, line, annotation, spans } = boxData;

    if (box && box.parentNode) box.remove();
    if (line && line.parentNode) line.remove();

    annotation.wordIndices.forEach(index => {
        const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
        if (span) {
            // Remove the correct highlight class
            if (annotation.colorClass) span.classList.remove(annotation.colorClass);

            // Remove highlight-related dataset properties
            delete span.dataset.annotationId;
            delete span.dataset.annotationClass;
            delete span.dataset.highlightCount;
            span.removeAttribute('title');

            // 🚀 Remove highlight-related classes
            span.classList.remove('hovered', 'highlighted', 'hovered', 'highlight-glow', 'highlight');

            // Remove hover event listeners (clone trick)
        const newSpan = span.cloneNode(true);
        span.parentNode.replaceChild(newSpan, span);
        }
    });

    // ✅ Explicitly remove glow from all related elements
    if (spans && spans.forEach) {
        spans.forEach(el => el.classList.remove('highlight-glow'));
    }
    if (box) box.classList.remove('annotation-box-glow');
    if (line) line.classList.remove('annotation-line-glow');

    annotationBoxes.delete(_id);
    annotationsMap.delete(_id);
});



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

function generateAnnotationId() {
  return 'ann-' + Math.random().toString(36).substr(2, 9);
}




function renderAnnotationBox(annotationData, readOnly = false, highlightClass = null) {
    const lastIndex = annotationData.wordIndices[annotationData.wordIndices.length - 1];
    const targetSpan = document.querySelector(`.poem-word[data-word-index="${lastIndex}"]`);
    if (!targetSpan) return;

    const box = document.createElement('div');
    box.className = 'annotation-box';
    box.dataset.annotationId = annotationData.annotationId;
    box.textContent = annotationData.text;

    // Apply highlight class if provided
    if (highlightClass) {
        box.classList.add(highlightClass);
        annotationData.colorClass = highlightClass; // store for later removal
    }

    document.body.appendChild(box);

    // Store entry **before** calling position logic
    annotationBoxes.set(annotationData._id, {
        box,
        targetSpan,
        annotation: annotationData
    });

    if (annotationData.relativePosition) {
        const { dx, dy } = annotationData.relativePosition;
        const baseRect = targetSpan.getBoundingClientRect();
        const baseX = baseRect.left + window.scrollX;
        const baseY = baseRect.top + window.scrollY;

        box.style.left = `${baseX + dx}px`;
        box.style.top = `${baseY + dy}px`;
        box.style.position = 'absolute';
    } else {
        updateAnnotationBoxPosition(annotationData._id);
    }

    // Apply z-index
    box.style.zIndex = currentZIndex++;

    // Hover styling
    box.addEventListener('mouseenter', () => {
        document.querySelectorAll(`.poem-word[data-annotation-id="${annotationData.annotationId}"]`)
            .forEach(el => el.classList.add('hovered'));
    });

    box.addEventListener('mouseleave', () => {
        document.querySelectorAll(`.poem-word[data-annotation-id="${annotationData.annotationId}"]`)
            .forEach(el => el.classList.remove('hovered'));
    });

    // Draw connecting line
    const line = drawLine(targetSpan, box, annotationData.annotationId);

    // Store reference
    annotationBoxes.set(annotationData._id, {
        box,
        targetSpan,
        annotation: annotationData,
        line
    });

    // Only allow dragging and editing if not read-only
    if (!readOnly) {
        makeDraggable(box, annotationData._id);
        makeEditable(box, annotationData.annotationId, annotationData, (updatedText) => {
            box.textContent = updatedText;
        });

        // Right-click to delete annotation box

box.addEventListener('contextmenu', async (e) => {
        e.preventDefault();

        // Ask once only
        if (!confirm('Delete this annotation?')) return;

        const annotationId = annotationData._id;
        const success = await deleteAnnotation(annotationId);
        if (!success) return;

        const { box, line, annotation } = annotationBoxes.get(annotationId);

       // Remove highlights from associated words
annotation.wordIndices.forEach(index => {
    const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
    if (!span) return;

    // Remove only the color class for THIS deleted annotation
    if (annotation.colorClass) {
        span.classList.remove(annotation.colorClass);
    }

    // Decrease highlight count
    let count = parseInt(span.dataset.highlightCount || '1', 10);
    count = Math.max(0, count - 1);

    if (count > 0) {
        // Update dataset with remaining count
        span.dataset.highlightCount = count;
        span.title = `Highlighted ${count} time${count > 1 ? 's' : ''}`;
    } else {
        // If no highlights left, remove ALL annotation-related data & hover effects
        delete span.dataset.annotationId;
        delete span.dataset.annotationClass;
        delete span.dataset.highlightCount;
        span.removeAttribute('title');

        span.classList.remove('highlight', 'highlighted', 'hovered', 'highlight-glow');

        // Remove hover event listeners (clone trick)
        const newSpan = span.cloneNode(true);
        span.parentNode.replaceChild(newSpan, span);
    }
});



        if (line) line.remove();
        if (box) box.remove();

        annotationBoxes.delete(annotationId);
        annotationsMap.delete(annotationId);

        socket.emit('delete-annotation', { _id: annotationId });
    });


    }
}



function updateAnnotationBoxPosition(annotationId) {
    const entry = annotationBoxes.get(annotationId);
    if (!entry) return;

    const { box, targetSpan } = entry;
    const poemContent = document.getElementById('poemContent');
    if (!poemContent) return;

    const poemRect = poemContent.getBoundingClientRect();
    const spanRect = targetSpan.getBoundingClientRect();
    const sidePadding = 20;
    const verticalSpacing = 10;

    // Let the browser compute the real width based on content
    box.style.width = 'auto';
    box.style.maxWidth = '300px';
    box.style.position = 'absolute';

    const boxWidth = box.offsetWidth;

    const spanCenter = spanRect.left + spanRect.width / 2;
    const poemCenter = (poemRect.left + poemRect.right) / 2;
    const preferRight = spanCenter > poemCenter;

    const enoughSpaceRight = (poemRect.right + sidePadding + boxWidth < window.innerWidth);
    const enoughSpaceLeft = (poemRect.left - sidePadding - boxWidth > 0);

    let placeOnRight;
    if (preferRight && enoughSpaceRight) {
        placeOnRight = true;
    } else if (!preferRight && enoughSpaceLeft) {
        placeOnRight = false;
    } else if (enoughSpaceRight) {
        placeOnRight = true;
    } else {
        placeOnRight = false;
    }

    let x = placeOnRight
        ? poemRect.right + sidePadding
        : poemRect.left - sidePadding - boxWidth;

    let y = spanRect.top + window.scrollY;

    // Avoid overlaps
    let collision = true;
    while (collision) {
        collision = false;
        annotationBoxes.forEach(({ box: otherBox }, id) => {
            if (id === annotationId) return;
            const otherRect = otherBox.getBoundingClientRect();
            const otherLeft = otherRect.left + window.scrollX;
            const otherTop = otherRect.top + window.scrollY;
            const otherRight = otherLeft + otherRect.offsetWidth;
            const otherBottom = otherTop + otherBox.offsetHeight;

            if (
                x < otherRight &&
                x + box.offsetWidth > otherLeft &&
                y < otherBottom &&
                y + box.offsetHeight > otherTop
            ) {
                y = otherBottom + verticalSpacing;
                collision = true;
            }
        });
    }

    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
}


function makeDraggable(el, annotationId) {
    let offsetX, offsetY;
    el.style.position = 'absolute';
    el.style.cursor = 'move';

    el.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();

        offsetX = e.clientX - el.getBoundingClientRect().left;
        offsetY = e.clientY - el.getBoundingClientRect().top;

        function onMouseMove(moveEvent) {
            el.style.left = `${moveEvent.clientX - offsetX}px`;
            el.style.top = `${moveEvent.clientY - offsetY}px`;

            const data = annotationBoxes.get(annotationId);
if (data && data.line) {
    const path = data.line;
    const startRect = data.targetSpan.getBoundingClientRect();
    const endRect = el.getBoundingClientRect();

    const startX = startRect.left + startRect.width / 2 + window.scrollX;
    const startY = startRect.top + startRect.height / 2 + window.scrollY;
    const endX = endRect.left + endRect.width / 2 + window.scrollX;
    const endY = endRect.top + endRect.height / 2 + window.scrollY;

    const curveAmount = 50;
    const midX = (startX + endX) / 2;

    const d = `
        M ${startX},${startY}
        C ${startX + curveAmount},${startY}
          ${midX - curveAmount},${endY}
          ${endX},${endY}
    `;
    path.setAttribute("d", d);
}

        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const entry = annotationBoxes.get(annotationId);
            if (!entry) return;

            const { annotation, box, targetSpan } = entry;

            const spanRect = targetSpan.getBoundingClientRect();
            const spanX = spanRect.left + window.scrollX;
            const spanY = spanRect.top + window.scrollY;

            const boxX = box.offsetLeft;
            const boxY = box.offsetTop;

            annotation.relativePosition = {
                dx: boxX - spanX,
                dy: boxY - spanY
            };

            updateAnnotationPosition(annotation);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function addHoverListenersForAnnotation(annotationId) {
    const spans = document.querySelectorAll(`.poem-word[data-annotation-id="${annotationId}"]`);
    const box = document.querySelector(`.annotation-box[data-annotation-id="${annotationId}"]`);
    const line = document.querySelector(`.annotation-line[data-annotation-id="${annotationId}"]`);

    if (!box) return;

    const bringToFront = () => {
        box.style.zIndex = currentZIndex++;
    };

    // Bring to front on span or box hover/click
    spans.forEach(span => {
        span.addEventListener('mouseenter', bringToFront);
        span.addEventListener('click', bringToFront);
    });
    box.addEventListener('mouseenter', bringToFront);
    box.addEventListener('click', bringToFront);

    // Hover effect from spans
    spans.forEach(span => {
        span.addEventListener('mouseenter', () => {
            spans.forEach(el => el.classList.add('hovered'));
            box.classList.add('hovered');
            if (line) line.classList.add('hovered');
        });
        span.addEventListener('mouseleave', () => {
            spans.forEach(el => el.classList.remove('hovered'));
            box.classList.remove('hovered');
            if (line) line.classList.remove('hovered');
        });
    });

    // Hover effect from box
    box.addEventListener('mouseenter', () => {
        spans.forEach(el => el.classList.add('hovered'));
        box.classList.add('hovered');
        if (line) line.classList.add('hovered');
    });

    box.addEventListener('mouseleave', () => {
        spans.forEach(el => el.classList.remove('hovered'));
        box.classList.remove('hovered');
        if (line) line.classList.remove('hovered');
    });

    const addGlow = () => {
        spans.forEach(el => el.classList.add('highlight-glow'));
        box.classList.add('annotation-box-glow');
        if (line) line.classList.add('annotation-line-glow');
    };

    const removeGlow = () => {
        spans.forEach(el => el.classList.remove('highlight-glow'));
        box.classList.remove('annotation-box-glow');
        if (line) line.classList.remove('annotation-line-glow');
    };

    // Hover effect from spans
    spans.forEach(span => {
        span.addEventListener('mouseenter', addGlow);
        span.addEventListener('mouseleave', removeGlow);
    });

    // Hover effect from annotation box
    box.addEventListener('mouseenter', addGlow);
    box.addEventListener('mouseleave', removeGlow);

}


async function loadExistingAnnotations(poemId = null, readOnly = false) {
    // Fallback to query string if not explicitly passed
    if (!poemId) {
        poemId = new URLSearchParams(window.location.search).get('poemId');
    }

    if (!poemId) {
        console.warn('No poemId provided — skipping annotation load.');
        return;
    }

    try {
        const response = await fetch(`/api/annotations/${poemId}`);
        if (!response.ok) throw new Error('Failed to fetch annotations');

        const annotations = await response.json();

        // Track highlight counts per word index
        const highlightCounts = new Map();

        for (const annotationData of annotations) {
            annotationsMap.set(annotationData._id, annotationData);

            for (const index of annotationData.wordIndices) {
                highlightCounts.set(index, (highlightCounts.get(index) || 0) + 1);
            }
        }

        for (const annotationData of annotations) {
            // Pick a CSS highlight class for this annotation
            const highlightClass = getNextHighlightClass();
            annotationData.colorClass = highlightClass; // store for later removal

            // Apply the highlight class to all words
            for (const index of annotationData.wordIndices) {
                const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
                if (span) {
                    span.dataset.annotationId = annotationData.annotationId;
                    span.classList.add('highlight'); // generic highlight class
                    span.classList.add(highlightClass); // specific color class
                    span.dataset.annotationClass = highlightClass; // for cleanup
                    span.title = annotationData.text;
                }
            }

            // Render the annotation box with the same highlight class
            renderAnnotationBox(annotationData, readOnly, highlightClass);

            // Add hover listeners
            addHoverListenersForAnnotation(annotationData.annotationId);
        }

    } catch (err) {
        console.error('Error loading existing annotations:', err);
    }
}


async function updateAnnotationPosition(annotation) {
    try {
        const response = await fetch(`/api/annotations/${annotation._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relativePosition: annotation.relativePosition })
        });

        if (!response.ok) {
            throw new Error(`Failed to update annotation position: ${response.statusText}`);
        }

        console.log(`Annotation ${annotation._id} position updated.`);

        // 🔄 Notify other clients about the position update
        socket.emit('update-annotation-position', {
            _id: annotation._id,
            relativePosition: annotation.relativePosition
        });

    } catch (err) {
        console.error('Error updating annotation position:', err);
    }
}

