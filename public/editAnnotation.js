// public/editAnnotation.js
import { annotationService } from './annotationService.js';

export function makeEditable(boxElement, annotationId, annotationData, onUpdate, modal, textarea) {
    boxElement.addEventListener('click', (e) => {
        // 🛡️ THE FIX: If the box was just dragged, don't open the modal
        if (boxElement.classList.contains('dragging')) {
            return; 
        }

        e.stopPropagation();

        // Fill and show modal
        textarea.value = annotationData.text;
        const rect = boxElement.getBoundingClientRect();
        modal.style.display = 'block';
        modal.style.position = 'absolute';
        modal.style.top = `${rect.top + window.scrollY}px`;
        modal.style.left = `${rect.left + window.scrollX}px`;

        modal.dataset.editingId = annotationData._id; 
        textarea.focus();
    });


    boxElement.addEventListener('click', (e) => {
        // Prevent opening if the user was just dragging the box
        if (!boxElement.classList.contains('dragging')) {
            openModalForEditing(e);
        }
    });
}