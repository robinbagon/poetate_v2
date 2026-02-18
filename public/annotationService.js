// public/annotationService.js
import socket from './socket.js';

export const annotationService = {
    async fetchAll(poemId) {
        const response = await fetch(`/api/annotations/${poemId}`);
        if (!response.ok) throw new Error('Failed to fetch');
        return await response.json();
    }, // <--- Comma is vital!

    async save(data) {
        const response = await fetch('/api/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const saved = await response.json();
        socket.emit('new-annotation', { ...data, _id: saved._id });
        return saved;
    },

    async delete(id, internalId, poemId) {
        const response = await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
        if (response.ok) {
            socket.emit('delete-annotation', { _id: id, annotationId: internalId, poemId });
        }
        return response.ok;
    },

    async updateText(id, newText, internalId, poemId) {
        const response = await fetch(`/api/annotations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: newText })
        });
        if (response.ok) {
            socket.emit('update-annotation-text', { _id: id, annotationId: internalId, newText, poemId });
        }
        return response.ok;
    },

    async updatePosition(annotation) {
        const response = await fetch(`/api/annotations/${annotation._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relativePosition: annotation.relativePosition })
        });
        if (response.ok) {
            socket.emit('update-annotation-position', {
                _id: annotation._id,
                annotationId: annotation.annotationId,
                relativePosition: annotation.relativePosition,
                poemId: annotation.poemId
            });
        }
    } 
}; // Close the object