// routes/shares.js
const express = require('express');
const router = express.Router();
const Poem = require('../models/Poem');
const Annotation = require('../models/Annotation');

// GET /api/shares/:shareId
router.get('/:shareId', async (req, res) => {
  const { shareId } = req.params;

  try {
    // 1. Find the poem containing this share link
    const poem = await Poem.findOne({ 'shareLinks.id': shareId });
    if (!poem) return res.status(404).json({ message: 'Share link not found' });

    // 2. Identify which link (mode) was used
    const shareLink = poem.shareLinks.find(link => link.id === shareId);
    if (!shareLink) return res.status(400).json({ message: 'Invalid share link' });

    // 3. Logic for logged-in collaborators
    if (req.session.userId && poem.userId?.toString() !== req.session.userId) {
      
      // Find if this user is already in the collaborators list
      const existingCollab = poem.collaborators.find(
        c => c.userId?.toString() === req.session.userId
      );

      if (!existingCollab) {
        // NEW COLLABORATOR: Add them with the mode from the link
        poem.collaborators.push({
          userId: req.session.userId,
          mode: shareLink.mode
        });
        await poem.save();
        console.log(`User ${req.session.userId} added as ${shareLink.mode} collaborator`);
      } 
      else if (existingCollab.mode === 'readonly' && shareLink.mode === 'editable') {
        // UPGRADE PERMISSIONS: They were readonly, but just used an edit link
        existingCollab.mode = 'editable';
        await poem.save();
        console.log(`User ${req.session.userId} upgraded to editable collaborator`);
      }
      // Note: We don't downgrade permissions if they use a readonly link after having edit access
    }

    // 4. Fetch annotations
    const annotations = await Annotation.find({ poemId: poem._id });

    // 5. Respond
    res.json({
      poem: {
        _id: poem._id,
        content: poem.content,
        title: poem.title
      },
      annotations,
      // The frontend "editable" status is determined strictly by the share link used
      editable: shareLink.mode === 'editable'
    });

  } catch (err) {
    console.error('Error fetching shared content:', err);
    res.status(500).json({ message: 'Failed to load shared content' });
  }
});

module.exports = router;