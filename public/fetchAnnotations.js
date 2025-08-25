document.addEventListener('DOMContentLoaded', async () => {
    const contentDiv = document.getElementById('poemContent');
    const urlParams = new URLSearchParams(window.location.search);
    const poemId = urlParams.get('poemId');

    // Ensure poemId exists in the URL
    if (poemId) {
        try {
            // Fetch annotations associated with the poem
            const annotationResponse = await fetch(`/api/annotations/${poemId}`);
            if (!annotationResponse.ok) throw new Error('Error fetching annotations');
            const annotations = await annotationResponse.json();

            // Attach .id field to each annotation and render it
            annotations.forEach(annotation => {
                annotation.id = annotation._id; // Fix: ensure 'id' is available for updates
                renderAnnotation(annotation);
            });

            console.log('Poem and annotations loaded successfully');
        } catch (error) {
            console.error("Failed to load the poem or annotations:", error.message);
            contentDiv.innerText = "Failed to load poem or annotations.";
        }
    } else {
        contentDiv.innerText = "Poem not found.";
    }
});

// Example function to render an annotation
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
        // Update the annotation's position
        annotation.position.x = event.clientX;
        annotation.position.y = event.clientY;
        annotationElement.style.left = `${annotation.position.x}px`;
        annotationElement.style.top = `${annotation.position.y}px`;

        // Update annotation position in the database
        updateAnnotationPositionInDatabase(annotation);
    });

    document.body.appendChild(annotationElement);
}
