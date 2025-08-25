document.addEventListener('DOMContentLoaded', () => {
    const poemContent = document.getElementById('poemContent');
    const annotationModal = document.getElementById('annotationModal');
    const annotationText = document.getElementById('annotationText');
    const saveAnnotationButton = document.getElementById('saveAnnotation');

    let selectedRange = null;
    let annotations = []; // Store annotations in memory

    // Show annotation modal when text is selected
    poemContent.addEventListener('mouseup', () => {
        const selection = window.getSelection();
        if (selection.toString().trim() !== '') {
            selectedRange = selection.getRangeAt(0);
            const rect = selectedRange.getBoundingClientRect();

            // Position the annotation modal near the selected text
            annotationModal.style.display = 'block';
            annotationModal.style.position = 'absolute';
            annotationModal.style.top = `${rect.bottom + window.scrollY}px`;
            annotationModal.style.left = `${rect.left + window.scrollX}px`;
        }
    });

    // Save annotation
    saveAnnotationButton.addEventListener('click', async () => {
        const text = annotationText.value.trim();
        if (text) {
            const selection = window.getSelection();
            const offsets = getSelectionOffsets(selection);

            // Create annotation object
            const annotation = {
                poemId: new URLSearchParams(window.location.search).get('poemId'),
                text,
                position: {
                    x: parseFloat(annotationModal.style.left),
                    y: parseFloat(annotationModal.style.top),
                },
                highlightRect: selectedRange.getBoundingClientRect(),
                offsets, // Store the start and end offsets
            };

            try {
                // Save annotation to the database
                const savedAnnotation = await saveAnnotationToDatabase(annotation);
                annotation.id = savedAnnotation.id; // Add the ID returned by the database

                // Add annotation to the DOM
                renderAnnotation(annotation);

                // Clear the modal and hide it
                annotationText.value = '';
                annotationModal.style.display = 'none';
            } catch (error) {
                console.error('Failed to save annotation:', error.message);
                alert('Failed to save annotation. Please try again.');
            }
        }
    });

    // Render annotation on the page
    function renderAnnotation(annotation) {
        const annotationElement = document.createElement('div');
        annotationElement.className = 'annotation';
        annotationElement.style.position = 'absolute';
        annotationElement.style.left = `${annotation.position.x}px`;
        annotationElement.style.top = `${annotation.position.y}px`;
        annotationElement.innerText = annotation.text;

        // Allow dragging annotations
        annotationElement.draggable = true;
        annotationElement.addEventListener('dragend', (event) => {
            annotation.position.x = event.clientX;
            annotation.position.y = event.clientY;
            annotationElement.style.left = `${annotation.position.x}px`;
            annotationElement.style.top = `${annotation.position.y}px`;

            // Update annotation position in the database
            updateAnnotationPositionInDatabase(annotation);
        });

        document.body.appendChild(annotationElement);
    }

    // Function to get the start and end offsets of the selected text
    function getSelectionOffsets(selection) {
        const range = selection.getRangeAt(0);
        const start = range.startOffset;
        const end = range.endOffset;
        return { start, end };
    }

    // Function to save annotation to the database
    async function saveAnnotationToDatabase(annotation) {
        try {
            const response = await fetch('/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotation),
            });

            if (!response.ok) {
                throw new Error(`Failed to save annotation: ${response.statusText}`);
            }

            const savedAnnotation = await response.json();
            return savedAnnotation;
        } catch (error) {
            console.error('Failed to save annotation:', error.message);
            throw error; // Re-throw the error to handle it in the calling function
        }
    }

    // Function to update annotation position in the database
    async function updateAnnotationPositionInDatabase(annotation) {
        try {
            const response = await fetch(`/api/annotations/${annotation.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: annotation.position }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update annotation position: ${response.statusText}`);
            }

            const updatedAnnotation = await response.json();
            return updatedAnnotation;
        } catch (error) {
            console.error('Failed to update annotation position:', error.message);
            throw error; // Re-throw the error to handle it in the calling function
        }
    }
});
