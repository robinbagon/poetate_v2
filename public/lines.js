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
    if (!svg) {
        console.error('SVG container for lines not found.');
        return;
    }

    // Compute coordinates relative to page
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

    // Prefer explicit param, then dataset on endElem
    annotationId = annotationId || endElem.dataset.annotationId || endElem.getAttribute('data-annotation-id');

    if (!annotationId) {
        annotationId = `tmp-${Math.random().toString(36).slice(2, 9)}`;
        endElem.dataset.annotationId = annotationId;
    }

    // Try to find an existing path for this annotationId
    let path = svg.querySelector(`.annotation-line[data-annotation-id="${annotationId}"]`);

    if (path) {
        path.setAttribute('d', d);
    } else {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('data-annotation-id', annotationId);
        path.classList.add('annotation-line');
        // NOTE: Stroke and Dash styles moved to style.css
        svg.appendChild(path);
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