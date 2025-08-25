// deleteAnnotation.js
import socket from './socket.js';


export async function deleteAnnotation(annotationId) {
  try {
    const response = await fetch(`/api/annotations/${annotationId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete annotation: ${response.statusText}`);
    }

    // Notify other clients about the deletion
    socket.emit('delete-annotation', { _id: annotationId });

    return true;
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return false;
  }
}
