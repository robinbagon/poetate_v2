// public/editAnnotation.js
import { annotationService } from './annotationService.js';

export function makeEditable(boxElement, annotationId, annotationData, onUpdate, modal, textarea) {
    
    boxElement.addEventListener('click', (e) => {
        // 🛡️ THE FIX: If the box was just dragged, don't open the modal
        if (boxElement.classList.contains('dragging')) {
            return; 
        }

        e.stopPropagation();

        // 1. Fill the textarea with existing text
        textarea.value = annotationData.text;

        // 2. Position the modal near the clicked box
        const rect = boxElement.getBoundingClientRect();
        modal.style.display = 'block';
        modal.style.position = 'absolute';
        modal.style.top = `${rect.top + window.scrollY}px`;
        modal.style.left = `${rect.left + window.scrollX}px`;

        // 3. Set the IDs for the save/delete logic to find
        // Note: Using both IDs to ensure compatibility with your touch and desktop logic
        modal.dataset.editingId = annotationId; 
        modal.dataset.dbId = annotationData._id;

        // 4. SHOW the Delete button because we are editing an existing annotation
        const deleteBtn = document.getElementById('deleteAnnotation');
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
        }

        textarea.focus();
    });

    // REMOVED: The second boxElement.addEventListener('click', ...) block 
    // that was calling openModalForEditing(e). It was redundant and causing the error.
}