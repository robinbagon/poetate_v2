// lines.js

/**
 * Draw/update a line between two DOM elements using a single SVG layer.
 * If a path for the same annotationId already exists, update its "d".
 * Otherwise create a new path and attach data-annotation-id.
 *
 * @param {HTMLElement} startElem - The source/highlight element.
 * @param {HTMLElement} endElem - The annotation box element.
 * @param {string} [annotationId] - optional explicit annotation id.
 * @returns {SVGPathElement} the path element
 */
export function drawLine(startElem, endElem, annotationId) {
  const svg = document.getElementById('annotation-lines');
  if (!svg) {
    console.error('SVG container for lines not found.');
    return;
  }

  // compute coords relative to page
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
    // If you really call drawLine before an annotationId exists, give it a temporary ID
    // (But it's better to ensure box.dataset.annotationId is set before calling drawLine.)
    annotationId = `tmp-${Math.random().toString(36).slice(2,9)}`;
    endElem.dataset.annotationId = annotationId;
    console.warn('drawLine: annotationId missing — assigned temporary id', annotationId);
  }

  // Try to find an existing path for this annotationId
  let path = svg.querySelector(`.annotation-line[data-annotation-id="${annotationId}"]`);

  if (path) {
    // update existing path
    path.setAttribute('d', d);
  } else {
    // create new path
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'grey');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-dasharray', '2 6');
    path.setAttribute('data-annotation-id', annotationId);
    path.classList.add('annotation-line');
    svg.appendChild(path);
  }

  // Cleanup any duplicates (shouldn't normally be necessary but safe)
  const duplicates = svg.querySelectorAll(`.annotation-line[data-annotation-id="${annotationId}"]`);
  duplicates.forEach(p => { if (p !== path) p.remove(); });

  return path;
}

/**
 * Redraw all lines for the annotationBoxes map.
 * Uses drawLine which will update existing paths in-place.
 */
export function redrawAllLines(annotationBoxes) {
  const svg = document.getElementById('annotation-lines');
  if (!svg) return;

  // Option A: update each existing path (preferred because it reuses paths)
  for (const { box, targetSpan, annotation } of annotationBoxes.values()) {
    const annotationId = annotation?.annotationId || box?.dataset?.annotationId;
    // drawLine will update an existing path if present
    drawLine(targetSpan, box, annotationId);
  }

  // If you prefer a fully fresh pass instead, uncomment:
  // svg.querySelectorAll('.annotation-line').forEach(l => l.remove());
  // for (const { box, targetSpan, annotation } of annotationBoxes.values()) {
  //   const annotationId = annotation?.annotationId || box?.dataset?.annotationId;
  //   drawLine(targetSpan, box, annotationId);
  // }
}
