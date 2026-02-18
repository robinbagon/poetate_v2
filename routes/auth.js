const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Poem = require('../models/Poem');
const crypto = require('crypto');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// 1. LOGIN
router.post('/login', async (req, res) => {
    const { email, password, pendingPoemId } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return res.status(400).json({ message: 'Invalid credentials' });

        req.session.userId = user._id;

        if (pendingPoemId) {
            await Poem.findOneAndUpdate(
                { _id: pendingPoemId, userId: null },
                { userId: user._id }
            );
        }
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// 2. REGISTER
router.post('/register', async (req, res) => {
    const { email, password, pendingPoemId } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = new User({ email, passwordHash });
        await user.save();

        try {
            await resend.emails.send({
                from: 'Poetate <info@poetate.org>',
                to: email,
                subject: 'Welcome to Poetate!',
                html: `<h2>Welcome to Poetate!</h2><p>Your account has been created successfully.</p>`
            });
        } catch (mailError) {
            console.error('Email failed to send:', mailError);
        }

        req.session.userId = user._id;
        if (pendingPoemId) {
            await Poem.findOneAndUpdate({ _id: pendingPoemId, userId: null }, { userId: user._id });
        }
        res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

// 3. FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(200).json({ message: 'If that account exists, a reset link has been sent.' });

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        const resetUrl = `https://poetate.org/reset-password/${token}`;
        await resend.emails.send({
            from: 'Poetate <info@poetate.org>',
            to: user.email,
            subject: 'Poetate Password Reset',
            html: `<p>Click below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`
        });
        res.status(200).json({ message: 'Reset email sent' });
    } catch (err) {
        res.status(500).json({ message: 'Error sending reset email' });
    }
});

// 4. RESET PASSWORD (SAVING)
router.post('/reset-password/:token', async (req, res) => {
    const { password } = req.body;
    const { token } = req.params;
    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) return res.status(400).json({ message: 'Token invalid or expired.' });

        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error during reset.' });
    }
});

// 5. LOGOUT
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logged out' });
    });
});

module.exports = router;    