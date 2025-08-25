// lines.js



/**
 * Draw a line between two DOM elements using an SVG layer.
 * @param {HTMLElement} startElem - The source/highlight element.
 * @param {HTMLElement} endElem - The annotation box element.
 */
export function drawLine(startElem, endElem) {
    const svg = document.getElementById('annotation-lines');
    if (!svg) {
        console.error("SVG container for lines not found.");
        return;
    }

    const startRect = startElem.getBoundingClientRect();
    const endRect = endElem.getBoundingClientRect();

    const startX = startRect.left + startRect.width / 2 + window.scrollX;
    const startY = startRect.top + startRect.height / 2 + window.scrollY;
    const endX = endRect.left + endRect.width / 2 + window.scrollX;
    const endY = endRect.top + endRect.height / 2 + window.scrollY;

    const curveAmount = 50; // adjust for curve sharpness
    const midX = (startX + endX) / 2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Cubic Bézier from start to end
    const d = `
        M ${startX},${startY}
        C ${startX + curveAmount},${startY}
          ${midX - curveAmount},${endY}
          ${endX},${endY}
    `;

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "grey");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-dasharray", "2 6");
    path.dataset.annotationId = endElem.dataset.annotationId;
    path.classList.add("annotation-line");


    svg.appendChild(path);
    return path;
}


/**
 * Clears all existing lines and redraws them for all annotations.
 * @param {Map} annotationBoxes - Map of annotationId -> { box, targetSpan, annotation }
 */
export function redrawAllLines(annotationBoxes) {
    const svg = document.getElementById('annotation-lines');
    if (!svg) return;

    // Remove all existing lines
    svg.querySelectorAll('.annotation-line').forEach(line => line.remove());

    // Redraw all lines
    for (const { box, targetSpan } of annotationBoxes.values()) {
        drawLine(targetSpan, box);
    }
}
