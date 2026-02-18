// routes/poem.js
const express = require('express');
const router = express.Router();
const Poem = require('../models/Poem');
const ensureAuthenticated = require('../middleware/authMiddleware');
const Annotation = require('../models/Annotation');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const tierLimits = require('../config/tierLimits'); // ✅ import from config

// GET poems submitted by the current user
router.get('/user', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const poems = await Poem.find({ userId: req.session.userId });
    res.json(poems);
  } catch (err) {
    console.error('Error fetching user poems:', err);
    res.status(500).json({ message: 'Server error fetching poems' });
  }
});

// POST a new poem
router.post('/', async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ message: 'Poem content is required' });
  }

  try {
    let user = null;

    if (req.session.userId) {
      user = await User.findById(req.session.userId);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check subscription expiry
      if (user.tier === 'pro' && user.subscriptionExpiry && user.subscriptionExpiry < Date.now()) {
        user.tier = 'free';
        user.subscriptionExpiry = null;
        await user.save();
      }

      // Enforce tier limits
      const poemCount = await Poem.countDocuments({ userId: user._id });
      const maxPoems = tierLimits[user.tier];

      if (poemCount >= maxPoems) {
        return res.status(403).json({ message: `Poem limit reached for ${user.tier} tier` });
      }
    }

    const poem = new Poem({
      content,
      title: content.split('\n')[0].substring(0, 50),
      userId: user ? user._id : null // allow anonymous submission
    });

    await poem.save();
    res.status(201).json(poem);
  } catch (err) {
    console.error('Error saving poem:', err);
    res.status(500).json({ message: 'Failed to save poem' });
  }
});

// ✅ New: usage endpoint for dashboard
router.get('/usage', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // downgrade expired subs
    if (user.tier === 'pro' && user.subscriptionExpiry && user.subscriptionExpiry < Date.now()) {
      user.tier = 'free';
      user.subscriptionExpiry = null;
      await user.save();
    }

    const poemsUsed = await Poem.countDocuments({ userId: user._id });
    const poemsAllowed = tierLimits[user.tier];

    res.json({
      tier: user.tier,
      poemsUsed,
      poemsAllowed,
      subscriptionExpiry: user.subscriptionExpiry,
    });
  } catch (err) {
    console.error('Error fetching usage:', err);
    res.status(500).json({ message: 'Failed to fetch usage info' });
  }
});

// GET /api/poems/shared-with-me
router.get('/shared-with-me', async (req, res) => {
  try {
    // 1. Check if session exists
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userId = req.session.userId;

    // 2. Find poems where the user is in the collaborators list
    // Use $in to ensure we are searching the array correctly
    const sharedPoems = await Poem.find({ 
      collaborators: { $in: [userId] } 
    });

    res.json(sharedPoems);
  } catch (err) {
    // This logs the ACTUAL error to your terminal/command prompt
    console.error('SERVER ERROR IN SHARED-WITH-ME:', err);
    res.status(500).json({ message: 'Server error fetching shared poems', error: err.message });
  }
});

// GET a specific poem by ID
router.get('/:poemId', async (req, res) => {
  try {
    const poem = await Poem.findById(req.params.poemId);
    if (!poem) {
      return res.status(404).json({ message: 'Poem not found' });
    }
    res.json(poem);
  } catch (err) {
    console.error('Error fetching poem:', err);
    res.status(500).json({ message: 'Failed to fetch poem' });
  }
});

// DELETE poem and its annotations
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const poem = await Poem.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!poem) {
      return res.status(404).json({ message: 'Poem not found or unauthorized' });
    }

    // Clean up related annotations
    await Annotation.deleteMany({ poemId: poem._id });

    res.status(200).json({ message: 'Poem and annotations deleted' });
  } catch (err) {
    console.error('Error deleting poem:', err);
    res.status(500).json({ message: 'Failed to delete poem' });
  }
});

// Allow enabling sharing
router.post('/:id/share', ensureAuthenticated, async (req, res) => {
  const { mode } = req.body; // 'readonly' or 'editable'
  const validModes = ['readonly', 'editable'];

  if (!validModes.includes(mode)) {
    return res.status(400).json({ message: 'Invalid share mode' });
  }

  try {
    const poem = await Poem.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!poem) return res.status(404).json({ message: 'Poem not found or unauthorized' });

    // Reuse existing link if it exists
    const existing = poem.shareLinks.find(link => link.mode === mode);
    if (existing) {
      return res.json({ shareId: existing.id, mode });
    }

    // Otherwise, create a new link
    const newShareId = uuidv4();
    poem.shareLinks.push({ id: newShareId, mode });
    await poem.save();

    res.json({ shareId: newShareId, mode });
  } catch (err) {
    console.error('Error creating share link:', err);
    res.status(500).json({ message: 'Could not create share link' });
  }
});

// ✅ RENAME a poem
router.patch('/:id', ensureAuthenticated, async (req, res) => {
  const { title } = req.body;

  if (title === undefined) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    // Find by ID AND userId to ensure ownership
    const poem = await Poem.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { title: title },
      { new: true } // returns the updated document
    );

    if (!poem) {
      return res.status(404).json({ message: 'Poem not found or unauthorized' });
    }

    res.json(poem);
  } catch (err) {
    console.error('Error renaming poem:', err);
    res.status(500).json({ message: 'Failed to rename poem' });
  }
});



module.exports = router;
