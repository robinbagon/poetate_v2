// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    try {
        const passwordHash = await bcrypt.hash(password, 10); // ✅ use correct field name
        const user = new User({ email, passwordHash });       // ✅ store in passwordHash
        await user.save();

        req.session.userId = user._id;
        res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.passwordHash); // ✅ compare with passwordHash
        if (!match) return res.status(400).json({ message: 'Invalid credentials' });

        req.session.userId = user._id;
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Get current logged-in user
router.get('/user', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not logged in' });
    }

    try {
        const user = await User.findById(req.session.userId).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logged out' });
    });
});

module.exports = router;
