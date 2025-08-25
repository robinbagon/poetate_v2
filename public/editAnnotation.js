// editAnnotation.js
import socket from './socket.js';

/**
 * Makes an annotation box editable on double-click.
 * @param {HTMLElement} boxElement - The DOM element of the annotation box.
 * @param {string} annotationId - The custom annotation ID.
 * @param {object} annotationData - The annotation object containing _id and text.
 * @param {function} onUpdate - Callback to run after text is updated.
 */
export function makeEditable(boxElement, annotationId, annotationData, onUpdate) {
    boxElement.addEventListener('dblclick', () => {
        const originalText = annotationData.text;

        // Create a textarea for editing
        const textarea = document.createElement('textarea');
        textarea.value = originalText;
        textarea.className = 'annotation-edit';

        // Clear the box and insert the textarea
        boxElement.innerHTML = '';
        boxElement.appendChild(textarea);
        textarea.focus();

        // Save on blur
        textarea.addEventListener('blur', async () => {
            const newText = textarea.value.trim();

            // Only update if text has changed and is not empty
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

                    // Emit to socket for real-time update
                    socket.emit('update-annotation-text', {
                        _id: annotationData._id,
                        newText
                    });
                } catch (err) {
                    alert('Failed to update annotation text.');
                    console.error(err);
                    onUpdate(originalText); // revert
                }
            } else {
                onUpdate(originalText); // unchanged or empty, revert
            }
        });
    });
}
