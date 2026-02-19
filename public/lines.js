// lines.js

/**
 * Ensures the SVG layer matches the full document size.
 * Call this on window resize and scroll.
 */
export function resizeSvgLayer() {
    const svg = document.getElementById('annotation-lines');
    if (svg) {
        svg.setAttribute('width', document.documentElement.scrollWidth);
        svg.setAttribute('height', document.documentElement.scrollHeight);
    }
}

/**
 * Draw/update a line between two DOM elements using a single SVG layer.
 */
export function drawLine(startElem, endElem, annotationId) {
    const svg = document.getElementById('annotation-lines');
    if (!svg) return;

    const startRect = startElem.getBoundingClientRect();
    const endRect = endElem.getBoundingClientRect();

    const startX = startRect.left + startRect.width / 2 + window.scrollX;
    const startY = startRect.top + startRect.height / 2 + window.scrollY;
    const endX   = endRect.left + endRect.width / 2 + window.scrollX;
    const endY   = endRect.top + endRect.height / 2 + window.scrollY;

    const curveAmount = 50;
    const midX = (startX + endX) / 2;
    const d = `M ${startX},${startY} 
               C ${startX + curveAmount},${startY} 
                 ${midX - curveAmount},${endY} 
                 ${endX},${endY}`;

    annotationId = annotationId || endElem.dataset.annotationId || endElem.getAttribute('data-annotation-id');

    if (!annotationId) {
        annotationId = `tmp-${Math.random().toString(36).slice(2, 9)}`;
        endElem.dataset.annotationId = annotationId;
    }

    let path = svg.querySelector(`.annotation-line[data-annotation-id="${annotationId}"]`);

    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('data-annotation-id', annotationId);
        path.classList.add('annotation-line');
        path.classList.add('line-new');
        svg.appendChild(path);
        } else {
        // Remove the entry animation class if it's just a redraw/move
        path.classList.remove('line-new');
    }

    path.setAttribute('d', d);

    /** * NEW: Sync Color Class
     * Look for 'highlight-X' on the startElem (the poem word) 
     * and apply it to the line.
     */
    const colorClass = Array.from(startElem.classList).find(cls => cls.startsWith('highlight-'));
    if (colorClass) {
        // Remove any old highlight classes and add the current one
        path.classList.forEach(cls => {
            if (cls.startsWith('highlight-')) path.classList.remove(cls);
        });
        path.classList.add(colorClass);
    }

    return path;
}

/**
 * Redraw all lines for the annotationBoxes map.
 */
export function redrawAllLines(annotationBoxes) {
    const svg = document.getElementById('annotation-lines');
    if (!svg) return;

    for (const { box, targetSpan, annotation } of annotationBoxes.values()) {
        if (!box || !targetSpan) continue;
        const annotationId = annotation?.annotationId || box?.dataset?.annotationId;
        drawLine(targetSpan, box, annotationId);
    }
}