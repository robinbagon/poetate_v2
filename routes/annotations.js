const express = require('express');
const router = express.Router();
const Annotation = require('../models/Annotation');
const ensureAuthenticated = require('../middleware/authMiddleware');

// ✅ POST a new annotation (anonymous or linked to logged-in user)
router.post('/', async (req, res) => {
  try {
    const { poemId, annotationId, text, highlight, wordIndices, timestamp, relativePosition } = req.body;

    if (!poemId || !text || !Array.isArray(wordIndices)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const annotation = new Annotation({
      poemId,
      annotationId,
      text,
      highlight,
      wordIndices,
      timestamp,
      relativePosition,
      userId: req.session?.userId || null
    });

    const saved = await annotation.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error saving annotation:', err);
    res.status(500).json({ error: 'Server error saving annotation' });
  }
});

// ✅ PUT update annotation by _id
router.put('/:id', async (req, res) => {
  const updates = {};
  const { relativePosition, text } = req.body;

  if (relativePosition && typeof relativePosition.dx === 'number' && typeof relativePosition.dy === 'number') {
    updates.relativePosition = relativePosition;
  }

  if (typeof text === 'string') {
    updates.text = text;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid update fields provided' });
  }

  try {
    const updated = await Annotation.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!updated) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('Error updating annotation:', err);
    res.status(500).json({ error: 'Server error updating annotation' });
  }
});

// ✅ GET annotations created by the logged-in user
router.get('/user', ensureAuthenticated, async (req, res) => {
  try {
    const annotations = await Annotation.find({ userId: req.session.userId });
    res.status(200).json(annotations);
  } catch (err) {
    console.error('Error fetching user annotations:', err);
    res.status(500).json({ message: 'Failed to fetch annotations' });
  }
});

// ✅ GET all annotations for a specific poem
router.get('/:poemId', async (req, res) => {
  try {
    const annotations = await Annotation.find({ poemId: req.params.poemId });
    res.status(200).json(annotations);
  } catch (err) {
    console.error('Error fetching annotations:', err);
    res.status(500).json({ error: 'Server error fetching annotations' });
  }
});

// ✅ DELETE an annotation by _id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Annotation.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.status(200).json({ message: 'Annotation deleted successfully' });
  } catch (err) {
    console.error('Error deleting annotation:', err);
    res.status(500).json({ error: 'Server error deleting annotation' });
  }
});

module.exports = router;
