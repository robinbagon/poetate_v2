// routes/shares.js
const express = require('express');
const router = express.Router();
const Poem = require('../models/Poem');
const Annotation = require('../models/Annotation');

// GET /api/shares/:shareId
router.get('/:shareId', async (req, res) => {
  const { shareId } = req.params;

  try {
    const poem = await Poem.findOne({ 'shareLinks.id': shareId });
    if (!poem) return res.status(404).json({ message: 'Share link not found' });

    const shareLink = poem.shareLinks.find(link => link.id === shareId);
    if (!shareLink) return res.status(400).json({ message: 'Invalid share link' });

    const annotations = await Annotation.find({ poemId: poem._id });

    res.json({
      poem: {
        _id: poem._id,
        content: poem.content
      },
      annotations,
      editable: shareLink.mode === 'editable'
    });
  } catch (err) {
    console.error('Error fetching shared content:', err);
    res.status(500).json({ message: 'Failed to load shared content' });
  }
});

module.exports = router;
