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
        // 1. Create the user in your database
        const passwordHash = await bcrypt.hash(password, 10);
        const user = new User({ email, passwordHash });
        await user.save();

        // 2. Handle Resend logic in a single background block
        // We do this in a separate try/catch so a failed email doesn't break the whole registration
        try {
            // Send the Template Email
            await resend.emails.send({
                from: 'Poetate <info@poetate.org>',
                to: email,
                subject: 'Welcome to Poetate!',
                templateId: 'welcome-email', // Ensure this is the "Name" or "ID" from Resend
                data: {
                    email: email, 
                },
            });

            // Add to Audience List
            await resend.contacts.create({
                email: email,
                unsubscribed: false,
                audienceId: 'your-audience-id-from-resend', 
            });

        } catch (resendError) {
            // Log the error but don't stop the user from logging in
            console.error('Resend service error:', resendError);
        }

        // 3. Set session and handle pending poems
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
        // Standard security practice: don't reveal if user exists
        if (!user) return res.status(200).json({ message: 'If that account exists, a reset link has been sent.' });

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        const resetUrl = `https://poetate.org/reset-password/${token}`;

        // Call Resend using the Template
        await resend.emails.send({
            from: 'Poetate <info@poetate.org>',
            to: user.email,
            subject: 'Poetate Password Reset',
            templateId: 'password-reset', // Must match name in Resend Dashboard
            data: {
                resetUrl: resetUrl // Maps to {{resetUrl}} in the HTML
            }
        });

        res.status(200).json({ message: 'Reset email sent' });
    } catch (err) {
        console.error('Forgot password error:', err);
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

// Get current logged-in user data
router.get('/user', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Not logged in' });
        }

        const user = await User.findById(req.session.userId).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
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