// annotations.js

import { drawLine, resizeSvgLayer, redrawAllLines } from './lines.js';
import { makeEditable } from './editAnnotation.js';
import { annotationService } from './annotationService.js';
import { authUI } from './authUI.js';
import { tidyAnnotations } from './layoutManager.js';
import socket from './socket.js';

const annotationBoxes = new Map();
const annotationsMap = new Map();

let selectedSpanIndices = [];
let currentZIndex = 100; 

let nextColorIndex = 0;
let isReadOnlyMode = false;
const maxColors = 8; 

function getNextHighlightClass() {
  const highlightClass = `highlight-${nextColorIndex}`;
  nextColorIndex = (nextColorIndex + 1) % maxColors;
  return highlightClass;
}

// ✅ Correct DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    authUI.init(); 
});

// FIX 4: Moved to module scope so renderAnnotationBox (and socket handlers) can call it
async function updateAnnotationPosition(annotation) {
    try {
        const response = await fetch(`/api/annotations/${annotation._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relativePosition: annotation.relativePosition })
        });

        if (!response.ok) throw new Error(`Failed to update position`);

        socket.emit('update-annotation-position', {
            _id: annotation._id,
            annotationId: annotation.annotationId,
            relativePosition: annotation.relativePosition,
            poemId: annotation.poemId,
            senderId: socket.id 
        });

    } catch (err) {
        console.error('Error updating annotation position:', err);
    }
}

export async function initAnnotations({ poemId = null, readOnly = false } = {}) {

    if (!poemId) {
        poemId = new URLSearchParams(window.location.search).get('poemId');
    }

    const tidyBtn = document.getElementById('tidyAnnotationsBtn');
    
    if (tidyBtn) {
        tidyBtn.addEventListener('click', async () => {
            if (!poemId) {
                console.error("Cannot tidy: No poemId found.");
                return;
            }

            tidyBtn.disabled = true;
            const originalContent = tidyBtn.innerHTML;
            tidyBtn.innerHTML = '✨ Organizing...';

            try {
                await tidyAnnotations(annotationBoxes, poemId);
            } catch (err) {
                console.error("Cleanup failed:", err);
            } finally {
                tidyBtn.disabled = false;
                tidyBtn.innerHTML = originalContent;
            }
        });
    }

    isReadOnlyMode = readOnly;
    const poemContent = document.getElementById('poemContent');
    const annotationModal = document.getElementById('annotationModal');
    const annotationText = document.getElementById('annotationText');
    const saveAnnotationButton = document.getElementById('saveAnnotation');
    const cancelAnnotationButton = document.getElementById('cancelAnnotation');

    if (poemId) socket.emit('join-poem-room', poemId);

    await loadExistingAnnotations(poemId, readOnly);

    window.addEventListener('resize', () => {
        resizeSvgLayer(); 
        for (const [id, data] of annotationBoxes.entries()) {
            const { annotation, box, targetSpan } = data;
            if (annotation.relativePosition) {
                const { dx, dy } = annotation.relativePosition;
                const spanRect = targetSpan.getBoundingClientRect();
                box.style.left = `${spanRect.left + window.scrollX + dx}px`;
                box.style.top  = `${spanRect.top + window.scrollY + dy}px`;
            } else {
                updateAnnotationBoxPosition(id);
            }
        }
        redrawAllLines(annotationBoxes);
    });

    if (!readOnly && poemContent) {
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
                    return overlapRatio > 0.5 && (selRect.top < spanRect.bottom && selRect.bottom > spanRect.top);
                });
            });

            if (selectedSpans.length > 0) {
                selectedSpanIndices = [...new Set(selectedSpans.map(span => span.dataset.wordIndex))];
                if (deleteAnnotationButton) deleteAnnotationButton.style.display = 'none';
                const rect = range.getBoundingClientRect();
                annotationModal.style.display = 'block';
                annotationModal.style.position = 'absolute';
                annotationModal.style.top = `${rect.bottom + window.scrollY}px`;
                annotationModal.style.left = `${rect.left + window.scrollX}px`;
            }
        });
    }

    const deleteAnnotationButton = document.getElementById('deleteAnnotation');

    if (deleteAnnotationButton) {
        deleteAnnotationButton.addEventListener('click', async () => {
            const editingId = annotationModal.dataset.editingId;
            if (!editingId) return;

            const annotationData = annotationsMap.get(editingId);
            if (!annotationData) return;

            if (confirm('Delete this annotation?')) {
                try {
                    const success = await annotationService.delete(
                        annotationData._id, 
                        editingId, 
                        poemId
                    );

                    if (success) {
                        // FIX 1 & 2: deleteAnnotationBox now takes annotationId consistently
                        deleteAnnotationBox(editingId);
                        
                        socket.emit('delete-annotation', { 
                            annotationId: editingId, 
                            poemId: poemId 
                        });

                        annotationModal.style.display = 'none';
                        delete annotationModal.dataset.editingId;
                        annotationText.value = '';
                    }
                } catch (err) {
                    console.error('Delete failed:', err);
                    alert('Could not delete annotation.');
                }
            }
        });
    }

    // --- Inside your initialization function ---

saveAnnotationButton.addEventListener('click', async () => {
    if (readOnly) return;
    const text = annotationText.value.trim();
    if (!text) return;

    const editingId = annotationModal.dataset.editingId;
    const deleteBtn = document.getElementById('deleteAnnotation');

    if (editingId) {
        // --- UPDATE EXISTING ---
        try {
            const annotationData = annotationsMap.get(editingId);
            if (!annotationData) return;

            const success = await annotationService.updateText(
                annotationData._id, 
                text, 
                editingId, 
                poemId
            );

            if (success) {
                annotationData.text = text;
                const entry = annotationBoxes.get(editingId);
                if (entry) entry.box.textContent = text;
                
                annotationData.wordIndices.forEach(index => {
                    const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
                    if (span) span.title = text;
                });
            }
        } catch (err) {
            console.error('Failed to update:', err);
        }
    } else if (selectedSpanIndices.length > 0) {
        // --- CREATE NEW ---
        const highlightClass = getNextHighlightClass();
        const annotationId = generateAnnotationId();
        const highlightText = selectedSpanIndices.map(index => {
            const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
            return span ? span.textContent : '';
        }).join(' ');

        const annotationData = {
            annotationId,
            text,
            highlight: highlightText,
            wordIndices: [...selectedSpanIndices],
            colorClass: highlightClass,
            poemId
        };

        try {
            const saved = await annotationService.save(annotationData);
            annotationData._id = saved._id;
            annotationsMap.set(annotationData.annotationId, annotationData);

            selectedSpanIndices.forEach(index => {
                const span = poemContent.querySelector(`.poem-word[data-word-index="${index}"]`);
                if (span) {
                    span.dataset.annotationId = annotationId;
                    span.classList.add('highlight', highlightClass);
                    span.title = text;
                }
            });

            renderAnnotationBox(annotationData, readOnly, highlightClass);
            if (typeof addHoverListenersForAnnotation === 'function') {
                addHoverListenersForAnnotation(annotationId);
            }
        } catch (err) {
            console.error('Failed to save:', err);
        }
    }

    // --- CLEANUP ---
    annotationText.value = '';
    annotationModal.style.display = 'none';
    delete annotationModal.dataset.editingId;
    selectedSpanIndices = [];
    
    // Reset delete button visibility
    if (deleteBtn) deleteBtn.style.display = 'none';
});

cancelAnnotationButton.addEventListener('click', () => {
    annotationModal.style.display = 'none';
    delete annotationModal.dataset.editingId;
    selectedSpanIndices = [];
    
    const deleteBtn = document.getElementById('deleteAnnotation');
    if (deleteBtn) deleteBtn.style.display = 'none';
});

// --- Global Listeners ---
document.addEventListener('DOMContentLoaded', resizeSvgLayer);
window.addEventListener('resize', resizeSvgLayer);
window.addEventListener('scroll', resizeSvgLayer);

// -------------------- SOCKET LISTENERS (module scope) --------------------

// FIX 2: Destructure annotationId (not _id) to match what the emitter sends
socket.on('delete-annotation', ({ annotationId }) => {
    deleteAnnotationBox(annotationId);
});

socket.on('new-annotation', data => {
    if (annotationsMap.has(data.annotationId)) {
        console.log("Annotation already exists locally. Skipping socket render.");
        return; 
    }

    annotationsMap.set(data.annotationId, data);

    // FIX 3: Use isReadOnlyMode (the actual variable) not the undefined isReadOnly
    renderAnnotationBox(data, isReadOnlyMode, data.colorClass);

    data.wordIndices.forEach(index => {
        const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
        if (span) {
            span.dataset.annotationId = data.annotationId;
            span.classList.add('highlight', data.colorClass);
            span.title = data.text;
        }
    });

    addHoverListenersForAnnotation(data.annotationId);
});

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

// -------------------- HELPER FUNCTIONS --------------------

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

    if (highlightClass) {
        box.classList.add(highlightClass);
        annotationData.colorClass = highlightClass; 
    }

    document.body.appendChild(box);

    // Force a reflow so offsetHeight is accurate for the collision logic
    const boxHeight = box.offsetHeight;

    // Store entry before calling position logic so it's "visible" to other boxes
    annotationBoxes.set(annotationData.annotationId, {
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
    } else {
        updateAnnotationBoxPosition(annotationData.annotationId);

        if (!readOnly) {
            const spanRect = targetSpan.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();

            annotationData.relativePosition = {
                dx: (boxRect.left + window.scrollX) - (spanRect.left + window.scrollX),
                dy: (boxRect.top + window.scrollY) - (spanRect.top + window.scrollY)
            };

            // FIX 4: updateAnnotationPosition is now in module scope, so this works
            updateAnnotationPosition(annotationData);
        }
    }

    box.style.zIndex = currentZIndex++;

    box.addEventListener('mouseenter', () => {
        document.querySelectorAll(`.poem-word[data-annotation-id="${annotationData.annotationId}"]`)
            .forEach(el => el.classList.add('hovered'));
    });

    box.addEventListener('mouseleave', () => {
        document.querySelectorAll(`.poem-word[data-annotation-id="${annotationData.annotationId}"]`)
            .forEach(el => el.classList.remove('hovered'));
    });

    const line = drawLine(targetSpan, box, annotationData.annotationId);

    annotationBoxes.set(annotationData.annotationId, {
        box,
        targetSpan,
        annotation: annotationData,
        line
    });

    if (!readOnly) {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (isTouch && typeof setupTouchListeners === 'function') {
            setupTouchListeners(box, annotationData);
        } else {
            makeDraggable(box, annotationData.annotationId);
        }

        // 🎯 This is the important part:
        // Ensure makeEditable is opening the modal and SHOWING the delete button
        makeEditable(
            box, 
            annotationData.annotationId, 
            annotationData, 
            (updatedText) => { box.textContent = updatedText; },
            document.getElementById('annotationModal'),
            document.getElementById('annotationText')
        );
    }
}


function updateAnnotationBoxPosition(annotationId) {
    const entry = annotationBoxes.get(annotationId);
    if (!entry) return;

    const { box, targetSpan } = entry;
    const poemContent = document.getElementById('poemContent');
    if (!poemContent) return;

    const sY = window.scrollY;
    const sX = window.scrollX;

    const pRect = poemContent.getBoundingClientRect();
    const poemRight = pRect.right + sX;
    const poemLeft = pRect.left + sX;

    const sRect = targetSpan.getBoundingClientRect();
    const spanTop = sRect.top + sY;
    const spanCenter = (sRect.left + sX) + (sRect.width / 2);
    const poemCenter = poemLeft + (pRect.width / 2);

    const sidePadding = 20;
    const verticalSpacing = 10;
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    const preferRight = spanCenter > poemCenter;
    const enoughSpaceRight = (poemRight + sidePadding + boxWidth < window.innerWidth + sX);
    const enoughSpaceLeft = (poemLeft - sidePadding - boxWidth > 0);

    let placeOnRight = (preferRight && enoughSpaceRight) || (!enoughSpaceLeft && enoughSpaceRight);

    let x = placeOnRight
        ? poemRight + sidePadding
        : poemLeft - sidePadding - boxWidth;

    let y = spanTop;

    let collision = true;
    let safetyCounter = 0;

    while (collision && safetyCounter < 50) {
        collision = false;
        safetyCounter++;

        for (const [id, other] of annotationBoxes.entries()) {
            if (id === annotationId) continue;

            const oBox = other.box;
            const oTop = parseFloat(oBox.style.top);
            const oLeft = parseFloat(oBox.style.left);
            const oBottom = oTop + oBox.offsetHeight;
            const oRight = oLeft + oBox.offsetWidth;

            if (
                x < oRight &&
                x + boxWidth > oLeft &&
                y < oBottom &&
                y + boxHeight > oTop
            ) {
                y = oBottom + verticalSpacing;
                collision = true;
                break; 
            }
        }
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

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        function onMouseMove(moveEvent) {
            el.style.left = `${moveEvent.pageX - offsetX}px`;
            el.style.top  = `${moveEvent.pageY - offsetY}px`;
            el.classList.add('dragging');

            const data = annotationBoxes.get(annotationId);
            if (data) {
                drawLine(data.targetSpan, el, annotationId);
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

            const boxRect = box.getBoundingClientRect();
            const boxX = boxRect.left + window.scrollX;
            const boxY = boxRect.top + window.scrollY;

            annotation.relativePosition = {
                dx: boxX - spanX,
                dy: boxY - spanY
            };

            // FIX 5: Save the new line back into the Map after drag ends
            const newLine = drawLine(targetSpan, box, annotationId);
            annotationBoxes.set(annotationId, { ...entry, annotation, line: newLine });

            updateAnnotationPosition(annotation);

            setTimeout(() => {
                el.classList.remove('dragging');
            }, 100);
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

    spans.forEach(span => {
        span.addEventListener('mouseenter', bringToFront);
        span.addEventListener('click', bringToFront);
    });
    box.addEventListener('mouseenter', bringToFront);
    box.addEventListener('click', bringToFront);

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

    spans.forEach(span => {
        span.addEventListener('mouseenter', addGlow);
        span.addEventListener('mouseleave', removeGlow);
    });

    box.addEventListener('mouseenter', addGlow);
    box.addEventListener('mouseleave', removeGlow);
}

async function loadExistingAnnotations(poemId = null, readOnly = false) {
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

        const highlightCounts = new Map();

        for (const annotationData of annotations) {
            annotationsMap.set(annotationData.annotationId, annotationData);

            for (const index of annotationData.wordIndices) {
                highlightCounts.set(index, (highlightCounts.get(index) || 0) + 1);
            }
        }

        for (const annotationData of annotations) {
            const highlightClass = getNextHighlightClass();
            annotationData.colorClass = highlightClass;

            for (const index of annotationData.wordIndices) {
                const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
                if (span) {
                    span.dataset.annotationId = annotationData.annotationId;
                    span.classList.add('highlight');
                    span.classList.add(highlightClass);
                    span.dataset.annotationClass = highlightClass;
                    span.title = annotationData.text;
                }
            }

            renderAnnotationBox(annotationData, readOnly, highlightClass);
            addHoverListenersForAnnotation(annotationData.annotationId);
        }

    } catch (err) {
        console.error('Error loading existing annotations:', err);
    }
}


function deleteAnnotationBox(annotationId) {
    const boxData = annotationBoxes.get(annotationId);
    if (!boxData) return;

    const { box, line, annotation } = boxData;

    if (box) box.remove();
    if (line) line.remove();

    annotation.wordIndices.forEach(index => {
        const span = document.querySelector(`.poem-word[data-word-index="${index}"]`);
        if (span) {
            span.classList.remove('highlight', 'hovered', 'highlight-glow', annotation.colorClass);
            delete span.dataset.annotationId;
            span.removeAttribute('title');

            const newSpan = span.cloneNode(true);
            span.parentNode.replaceChild(newSpan, span);
        }
    });

    
    annotationBoxes.delete(annotationId);
    annotationsMap.delete(annotationId);
}
}