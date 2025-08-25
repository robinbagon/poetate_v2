// Save annotation to the database
async function saveAnnotationToDatabase(annotation) {
    try {
        const response = await fetch('/api/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(annotation),
        });
        if (!response.ok) throw new Error('Error saving annotation');
        const savedAnnotation = await response.json();
        return savedAnnotation;
    } catch (error) {
        console.error('Failed to save annotation:', error.message);
    }
}

// Update annotation position in the database
async function updateAnnotationPositionInDatabase(annotation) {
    try {
        const response = await fetch(`/api/annotations/${annotation.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: annotation.position }),
        });
        if (!response.ok) throw new Error('Error updating annotation position');
    } catch (error) {
        console.error('Failed to update annotation position:', error.message);
    }
}

// Fetch annotations from the database
async function fetchAnnotations(poemId) {
    try {
        const response = await fetch(`/api/annotations/${poemId}`);
        if (!response.ok) throw new Error('Error fetching annotations');
        const annotations = await response.json();
        return annotations;
    } catch (error) {
        console.error('Failed to fetch annotations:', error.message);
        return [];
    }
}