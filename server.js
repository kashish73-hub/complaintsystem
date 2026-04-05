// ============================================
// server.js - Main Application Entry Point
// ============================================
// This is the heart of the application.
// It sets up Express.js, connects all routes,
// and starts listening for HTTP requests.
//
// Key Concepts Used:
//  - Express.js: Web framework for Node.js
//  - Middleware: Functions that run between request & response
//  - Sessions: Server-side storage to track logged-in users
//  - REST API: Backend serves JSON data to frontend
// ============================================

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

// Create the Express application
const app = express();
const PORT = 3000; // Server will run at http://localhost:3000

// ── MIDDLEWARE SETUP ───────────────────────
// Middleware runs on every request before it reaches route handlers

// 1. Body Parser: Reads JSON data sent from frontend forms
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 2. Session Middleware: Enables login sessions
//    Sessions store user info on the server (NOT in cookies)
app.use(session({
    secret: 'feedback_system_secret_key_2024', // Change this in production!
    resave: false,                 // Don't re-save session if unchanged
    saveUninitialized: false,      // Don't save empty sessions
    cookie: { 
        maxAge: 1000 * 60 * 60 * 2 // Session expires after 2 hours
    }
}));

// 3. Static Files: Serve HTML, CSS, JS files from /public folder
//    Any file in /public is accessible via http://localhost:3000/filename
app.use(express.static(path.join(__dirname, 'public')));

// ── ROUTE SETUP ────────────────────────────
// Import and mount route modules
// Each route file handles a specific feature area

const authRoutes = require('./routes/auth');         // Login/Logout
const feedbackRoutes = require('./routes/feedback'); // Student feedback
const adminRoutes = require('./routes/admin');       // Admin dashboard

// Mount routes with prefixes:
// All auth routes start with /auth  (e.g., /auth/student-login)
// All feedback routes start with /feedback
// All admin routes start with /admin
app.use('/auth', authRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/admin', adminRoutes);

// ── PAGE ROUTES ────────────────────────────
// Serve HTML pages when user navigates in browser

// Homepage / Login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Student dashboard (protected - redirect if not logged in)
app.get('/student', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Admin dashboard (protected - redirect if not admin)
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── 404 HANDLER ────────────────────────────
// Runs if no route matched the request
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── ERROR HANDLER ──────────────────────────
// Catches any unhandled errors and returns a clean response
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── START SERVER ───────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║   Student Feedback System - Running  ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  URL: http://localhost:${PORT}       ║`);
    console.log('╚══════════════════════════════════════╝');
    console.log('');
});
