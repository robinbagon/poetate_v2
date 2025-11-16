// editAnnotation.js
import socket from './socket.js';

/**
 * Makes an annotation box editable (desktop: double-click, touch: tap).
 * @param {HTMLElement} boxElement - The DOM element of the annotation box.
 * @param {string} annotationId - The custom annotation ID.
 * @param {object} annotationData - The annotation object containing _id and text.
 * @param {function} onUpdate - Callback to run after text is updated.
 */
export function makeEditable(boxElement, annotationId, annotationData, onUpdate) {
    const enableEditing = () => {
        const originalText = annotationData.text;

        // Create a textarea for editing
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.className = 'annotation-edit';

        // Replace box content with textarea    
        boxElement.innerHTML = '';
        boxElement.appendChild(textarea);
        textarea.focus();

        // Save on blur
        textarea.addEventListener('blur', async () => {
            const newText = textarea.value.trim();

            if (newText && newText !== originalText) {
                try {
                    const response = await fetch(`/api/annotations/${annotationData._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: newText })
                    });

                    if (!response.ok) throw new Error('Failed to update annotation text');

                    annotationData.text = newText;
                    onUpdate(newText);

                    // Emit update to others via socket
                    socket.emit('update-annotation-text', {
                        _id: annotationData._id,
                        annotationId: annotationData.annotationId,
                        newText,
                        poemId: annotationData.poemId
                    });
                } catch (err) {
                    console.error(err);
                    alert('Failed to update annotation text.');
                    onUpdate(originalText); // revert
                }
            } else {
                onUpdate(originalText); // unchanged or empty, revert
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
