const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Poem = require('../models/Poem');
const crypto = require('crypto');
const { Resend } = require('resend'); // 1. Import Resend

// 2. Initialize Resend with your API Key from the .env file
const resend = new Resend(process.env.RESEND_API_KEY);

// Register
router.post('/register', async (req, res) => {
    const { email, password, pendingPoemId } = req.body;

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = new User({ email, passwordHash });
        await user.save();

        // --- 3. START EMAIL LOGIC ---
        try {
            await resend.emails.send({
                from: 'Poetate <info@poetate.org>',
                to: email,
                subject: 'Welcome to Poetate!',
                html: `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2>Welcome to Poetate!</h2>
                        <p>Your account has been created successfully.</p>
                        <p>You can now save your poems, share them with the world, and join our creative community.</p>
                        <hr />
                        <p style="font-size: 0.8em; color: #666;">If you didn't create this account, please ignore this email.</p>
                    </div>
                `
            });
            console.log(`Welcome email sent to ${email}`);
        } catch (mailError) {
            // We log the error but don't stop the registration process 
            // otherwise a user is registered but thinks they aren't.
            console.error('Email failed to send:', mailError);
        }
        // --- END EMAIL LOGIC ---

        req.session.userId = user._id;

        if (pendingPoemId) {
            await Poem.findOneAndUpdate(
                { _id: pendingPoemId, userId: null }, 
                { userId: user._id }
            );
        }

        res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

// Request Password Reset
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            // We say "email sent" even if user doesn't exist for security 
            // so hackers can't "fish" for valid emails.
            return res.status(200).json({ message: 'If that account exists, a reset link has been sent.' });
        }

        // Create a unique token
        const token = crypto.randomBytes(20).toString('hex');

        // Set token and expiration (1 hour from now)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; 
        await user.save();

        const resetUrl = `https://poetate.org/reset-password/${token}`;

        await resend.emails.send({
            from: 'Poetate <info@poetate.org>',
            to: user.email,
            subject: 'Poetate Password Reset',
            html: `<p>You requested a password reset. Click the link below to set a new one:</p>
                   <a href="${resetUrl}">${resetUrl}</a>
                   <p>This link will expire in 1 hour.</p>`
        });

        res.status(200).json({ message: 'Reset email sent' });
    } catch (err) {
        res.status(500).json({ message: 'Error sending reset email' });
    }
});

module.exports = router;