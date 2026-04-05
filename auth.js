// ============================================
// routes/auth.js - Authentication Routes
// ============================================
// Handles: Student Login, Admin Login, Logout
// Key Concept: Sessions are used to remember who is logged in.
// bcryptjs is used to securely compare passwords.
// ============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// ── STUDENT LOGIN ──────────────────────────
// POST /auth/student-login
// Receives: { roll_number, password }
router.post('/student-login', async (req, res) => {
    const { roll_number, password } = req.body;

    // Basic input validation
    if (!roll_number || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Roll number and password are required.' 
        });
    }

    try {
        // Query DB: find student with this roll number
        const [rows] = await db.execute(
            'SELECT * FROM students WHERE roll_number = ?',
            [roll_number]  // Using ? prevents SQL Injection attacks
        );

        // If no student found
        if (rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid roll number or password.' 
            });
        }

        const student = rows[0];

        // Compare entered password with hashed password in DB
        // bcrypt.compare() returns true if they match
        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid roll number or password.' 
            });
        }

        // ✅ Login successful — save student info in session
        req.session.user = {
            id: student.id,
            name: student.name,
            roll_number: student.roll_number,
            department: student.department,
            semester: student.semester,
            role: 'student'
        };

        res.json({ 
            success: true, 
            message: 'Login successful!',
            user: req.session.user
        });

    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ success: false, message: 'Server error. Try again.' });
    }
});

// ── ADMIN LOGIN ────────────────────────────
// POST /auth/admin-login
// Receives: { email, password }
router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email and password are required.' 
        });
    }

    try {
        // Find admin by email
        const [rows] = await db.execute(
            'SELECT * FROM admins WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password.' 
            });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password.' 
            });
        }

        // ✅ Admin login successful — save in session
        req.session.user = {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: 'admin'
        };

        res.json({ 
            success: true, 
            message: 'Admin login successful!',
            user: req.session.user
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error. Try again.' });
    }
});

// ── LOGOUT ─────────────────────────────────
// POST /auth/logout
// Destroys the session (logs user out)
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed.' });
        }
        res.json({ success: true, message: 'Logged out successfully.' });
    });
});

// ── GET SESSION USER ───────────────────────
// GET /auth/me
// Returns current logged-in user info
router.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Not logged in.' });
    }
});

module.exports = router;
