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
        try {
            // Send the Welcome Email using direct HTML
            await resend.emails.send({
                from: 'Poetate <info@poetate.org>',
                to: email,
                subject: 'Welcome to Poetate!',
                html: `
                    <div style="font-family: 'Space Mono', monospace, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #000;">
                        <h1 style="font-size: 1.5rem; text-transform: uppercase; margin-bottom: 20px; border-bottom: 4px solid #000; padding-bottom: 10px;">Welcome to Poetate</h1>
                        <p style="line-height: 1.6;">Your account is ready. You can now save your poems, share them with others, and collaborate in real-time.</p>
                        
                        <div style="margin: 30px 0;">
                            <a href="https://poetate.org/dashboard.html" 
                               style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border: 1px solid #000; font-weight: bold; text-transform: uppercase; font-size: 0.8rem;">
                               Enter Dashboard
                            </a>
                        </div>

                        <p style="font-size: 0.8rem; color: #666; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                            This email was sent to ${email} regarding your new account.
                        </p>
                    </div>
                `
            });

            // Add to Audience List (Keep this if your Audience ID is correct)
            if (process.env.RESEND_AUDIENCE_ID) {
                await resend.contacts.create({
                    email: email,
                    unsubscribed: false,
                    audienceId: process.env.RESEND_AUDIENCE_ID, 
                });
            }

        } catch (resendError) {
            // Log the error but don't stop the user from logging in
            console.error('Resend service error:', resendError);
        }

        // 3. Set session and handle pending poems
        req.session.userId = user._id;
        
        if (pendingPoemId) {
            // Link the poem created as a guest to the new user
            await Poem.findOneAndUpdate(
                { _id: pendingPoemId, userId: null }, 
                { userId: user._id }
            );
            console.log(`✅ Guest poem ${pendingPoemId} linked to new user ${user._id}`);
        }
        
        res.status(201).json({ message: 'Registration successful' });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

/// 3. FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        
        // Security: Don't reveal if user exists
        if (!user) {
            return res.status(200).json({ message: 'If that account exists, a reset link has been sent.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `https://poetate.org/reset-password/${token}`;

        // 🚀 Sending HTML directly via the SDK
        const { data, error } = await resend.emails.send({
            from: 'Poetate <info@poetate.org>',
            to: user.email,
            subject: 'Poetate Password Reset',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
                    <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">Poetate</h2>
                    <p>You requested a password reset for your account.</p>
                    <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p style="color: #666; font-size: 0.8rem;">If you didn't request this, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
                    <p style="font-size: 0.7rem; color: #999;">poetate.org</p>
                </div>
            `
        });

        if (error) {
            console.error('Resend SDK Error:', error);
            // We still return 200 for security
        } else {
            console.log('✅ Reset email sent successfully:', data.id);
        }

        res.status(200).json({ message: 'If that account exists, a reset link has been sent.' });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(200).json({ message: 'If that account exists, a reset link has been sent.' });
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