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
    if (!svg || !startElem || !endElem) return;

    // 1. Get the Rects
    const startRect = startElem.getBoundingClientRect();
    const endRect = endElem.getBoundingClientRect();

    // 2. Calculate Coordinates
    const startX = startRect.left + startRect.width / 2 + window.scrollX;
    const startY = startRect.top + startRect.height / 2 + window.scrollY;
    const endX   = endRect.left + endRect.width / 2 + window.scrollX;
    const endY   = endRect.top + endRect.height / 2 + window.scrollY;

    const curveAmount = 50;
    const midX = (startX + endX) / 2;
    const d = `M ${startX},${startY} C ${startX + curveAmount},${startY} ${midX - curveAmount},${endY} ${endX},${endY}`;

    // 3. 🎯 THE CRITICAL FIX: Ensure ID consistency
    const id = annotationId; 
    if (!id) return;

    // 4. Find the path - Use ID attribute for faster/more reliable lookup
    let path = svg.querySelector(`path[data-annotation-id="${id}"]`);

    if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('data-annotation-id', id);
        path.classList.add('annotation-line');
        svg.appendChild(path);
    }

    // 5. Update the path data
    path.setAttribute('d', d);

    // 6. Sync Colors (Simplified)
    const colorClass = Array.from(startElem.classList).find(cls => cls.startsWith('highlight-'));
    if (colorClass) {
        // Remove old highlights and add current one
        path.setAttribute('class', `annotation-line ${colorClass}`);
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