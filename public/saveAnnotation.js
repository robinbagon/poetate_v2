    // saveAnnotation.js

export async function saveAnnotation(annotationData) {
    try {
        const response = await fetch('/api/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(annotationData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save annotation');
        }

        const savedAnnotation = await response.json();
        console.log('Annotation saved successfully:', savedAnnotation);
        return savedAnnotation;
    } catch (error) {
        console.error('Error saving annotation:', error);
        alert('Failed to save annotation. Please try again.');
        throw error; // Optional: re-throw if you want calling code to also handle it
    }
}
