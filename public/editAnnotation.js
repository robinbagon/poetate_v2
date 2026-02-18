// public/editAnnotation.js
import { annotationService } from './annotationService.js';

export function makeEditable(boxElement, annotationId, annotationData, onUpdate) {
    const enableEditing = () => {
        const originalText = annotationData.text;
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.className = 'annotation-edit';

        boxElement.innerHTML = '';
        boxElement.appendChild(textarea);
        textarea.focus();

        textarea.addEventListener('blur', async () => {
            const newText = textarea.value.trim();

            if (newText && newText !== originalText) {
                // CALL THE SERVICE
                const success = await annotationService.updateText(
                    annotationData._id, 
                    newText, 
                    annotationData.annotationId, 
                    annotationData.poemId
                );

                if (success) {
                    annotationData.text = newText;
                    onUpdate(newText);
                } else {
                    alert('Failed to update.');
                    onUpdate(originalText);
                }
            } else {
                onUpdate(originalText);
            }
        });
    };

    // Desktop: double-click to edit
    boxElement.addEventListener('dblclick', enableEditing);

    // Touch: single tap to edit
    let touchStartTime = 0;
    boxElement.addEventListener('touchstart', () => {
        touchStartTime = Date.now();
    });

    boxElement.addEventListener('touchend', e => {
        const duration = Date.now() - touchStartTime;
        if (duration < 300) {
            e.preventDefault(); // prevent accidental zoom
            enableEditing();
        }
    });
}
