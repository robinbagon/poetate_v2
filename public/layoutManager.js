import { annotationService } from './annotationService.js'; 
import { redrawAllLines } from './lines.js';

export async function tidyAnnotations(annotationBoxes, poemId) {
    const entries = Array.from(annotationBoxes.entries());
    if (entries.length === 0) return;

    const poemContent = document.getElementById('poemContent');
    const poemRect = poemContent.getBoundingClientRect();
    const poemMidpoint = poemRect.left + (poemRect.width / 2) + window.scrollX;
    
    const marginPadding = 45; 
    const collisionBuffer = 12; 

    // 1. Sort by vertical position so we process top-to-bottom
    entries.sort((a, b) => a[1].targetSpan.offsetTop - b[1].targetSpan.offsetTop);

    let leftCount = 0;
    let rightCount = 0;

    // 2. Assign sides using Weighted Proximity
    let particles = entries.map(([id, data]) => {
        const spanRect = data.targetSpan.getBoundingClientRect();
        const spanMidX = spanRect.left + (spanRect.width / 2) + window.scrollX;
        
        // naturalSide is where the highlight actually sits
        const naturalSide = spanMidX < poemMidpoint ? 'left' : 'right';
        let assignedSide = naturalSide;

        // "The Cross-Over Check": 
        // If the natural side is significantly more crowded than the other,
        // switch sides to maintain visual balance.
        const imbalanceThreshold = 2; // Flip if one side has 2+ more boxes
        if (naturalSide === 'left' && (leftCount - rightCount) > imbalanceThreshold) {
            assignedSide = 'right';
        } else if (naturalSide === 'right' && (rightCount - leftCount) > imbalanceThreshold) {
            assignedSide = 'left';
        }

        // Increment counters based on final assignment
        assignedSide === 'left' ? leftCount++ : rightCount++;

        const parentLine = data.targetSpan.closest('.poem-line') || 
                           data.targetSpan.closest('div') || 
                           poemContent;
        const lineRect = parentLine.getBoundingClientRect();

        const startX = assignedSide === 'left' 
            ? (lineRect.left + window.scrollX) - data.box.offsetWidth - marginPadding 
            : (lineRect.right + window.scrollX) + marginPadding;

        return {
            id,
            data,
            h: data.box.offsetHeight,
            w: data.box.offsetWidth,
            x: startX,
            y: spanRect.top + window.scrollY, 
            targetY: spanRect.top + window.scrollY,
            side: assignedSide,
            vy: 0
        };
    });

    // 3. Physics Simulation (Resolving Vertical Overlaps)
    for (let i = 0; i < 200; i++) {
        particles.sort((a, b) => a.y - b.y);

        for (let j = 0; j < particles.length; j++) {
            const p1 = particles[j];
            p1.y += (p1.targetY - p1.y) * 0.1;

            for (let k = j + 1; k < particles.length; k++) {
                const p2 = particles[k];
                if (p1.side !== p2.side) continue;

                const overlap = (p1.y + p1.h + collisionBuffer) - p2.y;
                if (overlap > 0) {
                    p1.y -= overlap * 0.5;
                    p2.y += overlap * 0.5;
                }
            }
        }
    }

    // 4. Final Render & Database Update
    const updates = particles.map(p => {
        p.data.box.style.left = `${p.x}px`;
        p.data.box.style.top = `${p.y}px`;

        const spanRect = p.data.targetSpan.getBoundingClientRect();
        p.data.annotation.relativePosition = {
            dx: p.x - (spanRect.left + window.scrollX),
            dy: p.y - (spanRect.top + window.scrollY)
        };
        
        return annotationService.updatePosition(p.data.annotation);
    });

    await Promise.all(updates);
    redrawAllLines(annotationBoxes);
}