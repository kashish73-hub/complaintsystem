// ============================================
// routes/feedback.js - Feedback Routes
// ============================================
// Handles: Submit feedback, Get courses, Check if already submitted
// Key Concept: CRUD operations on feedback table
// Only logged-in students can submit feedback (middleware check)
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// ── MIDDLEWARE: Check if student is logged in ──
// This runs BEFORE any route below that needs authentication
function requireStudentLogin(req, res, next) {
    if (req.session.user && req.session.user.role === 'student') {
        next(); // User is logged in, continue to route
    } else {
        res.status(401).json({ success: false, message: 'Please login first.' });
    }
}

// ── GET ALL COURSES ────────────────────────
// GET /feedback/courses
// Returns courses matching the student's semester
router.get('/courses', requireStudentLogin, async (req, res) => {
    try {
        const semester = req.session.user.semester;
        const department = req.session.user.department;

        // Get courses for student's semester (show their dept + general courses)
        const [courses] = await db.execute(
            `SELECT * FROM courses 
             WHERE semester = ? 
             ORDER BY course_code`,
            [semester]
        );

        res.json({ success: true, courses });

    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch courses.' });
    }
});

// ── GET ALL COURSES (for dropdown, all semesters) ──
// GET /feedback/all-courses
router.get('/all-courses', requireStudentLogin, async (req, res) => {
    try {
        const [courses] = await db.execute(
            'SELECT * FROM courses ORDER BY semester, course_code'
        );
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch courses.' });
    }
});

// ── CHECK ALREADY SUBMITTED ────────────────
// GET /feedback/check/:courseId
// Checks if this student already submitted feedback for a course
router.get('/check/:courseId', requireStudentLogin, async (req, res) => {
    try {
        const studentId = req.session.user.id;
        const courseId = req.params.courseId;

        const [rows] = await db.execute(
            'SELECT id FROM feedback WHERE student_id = ? AND course_id = ?',
            [studentId, courseId]
        );

        res.json({ 
            success: true, 
            alreadySubmitted: rows.length > 0 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Check failed.' });
    }
});

// ── SUBMIT FEEDBACK ────────────────────────
// POST /feedback/submit
// Receives: { course_id, teaching_rating, content_rating, difficulty_rating, overall_rating, comments }
router.post('/submit', requireStudentLogin, async (req, res) => {
    const { course_id, teaching_rating, content_rating, difficulty_rating, overall_rating, comments } = req.body;
    const studentId = req.session.user.id;

    // ── Validation ──
    if (!course_id || !teaching_rating || !content_rating || !difficulty_rating || !overall_rating) {
        return res.status(400).json({ 
            success: false, 
            message: 'All rating fields are required.' 
        });
    }

    // All ratings must be between 1 and 5
    const ratings = [teaching_rating, content_rating, difficulty_rating, overall_rating];
    for (let r of ratings) {
        if (r < 1 || r > 5) {
            return res.status(400).json({ 
                success: false, 
                message: 'Ratings must be between 1 and 5.' 
            });
        }
    }

    // Comments max 500 characters
    if (comments && comments.length > 500) {
        return res.status(400).json({ 
            success: false, 
            message: 'Comments must be under 500 characters.' 
        });
    }

    try {
        // Check if already submitted for this course
        const [existing] = await db.execute(
            'SELECT id FROM feedback WHERE student_id = ? AND course_id = ?',
            [studentId, course_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ 
                success: false, 
                message: 'You have already submitted feedback for this course.' 
            });
        }

        // INSERT feedback into database (CREATE operation)
        const [result] = await db.execute(
            `INSERT INTO feedback 
             (student_id, course_id, teaching_rating, content_rating, difficulty_rating, overall_rating, comments) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [studentId, course_id, teaching_rating, content_rating, difficulty_rating, overall_rating, comments || null]
        );

        res.json({ 
            success: true, 
            message: 'Feedback submitted successfully! Thank you.',
            feedbackId: result.insertId
        });

    } catch (error) {
        console.error('Submit feedback error:', error);
        // MySQL error 1062 = Duplicate entry (unique constraint violation)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ 
                success: false, 
                message: 'You have already submitted feedback for this course.' 
            });
        }
        res.status(500).json({ success: false, message: 'Could not submit feedback.' });
    }
});

// ── GET MY FEEDBACK HISTORY ────────────────
// GET /feedback/my-history
// Returns all feedback submitted by the logged-in student
router.get('/my-history', requireStudentLogin, async (req, res) => {
    try {
        const studentId = req.session.user.id;

        // JOIN query: combines feedback + courses tables
        const [rows] = await db.execute(
            `SELECT f.id, f.teaching_rating, f.content_rating, 
                    f.difficulty_rating, f.overall_rating, f.comments, f.submitted_at,
                    c.course_code, c.course_name, c.teacher_name
             FROM feedback f
             JOIN courses c ON f.course_id = c.id
             WHERE f.student_id = ?
             ORDER BY f.submitted_at DESC`,
            [studentId]
        );

        res.json({ success: true, history: rows });

    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch history.' });
    }
});

// ── GET SPECIFIC FEEDBACK FOR EDITING ──────
// GET /feedback/get/:feedbackId
// Returns a specific feedback record for editing
router.get('/get/:feedbackId', requireStudentLogin, async (req, res) => {
    try {
        const feedbackId = req.params.feedbackId;
        const studentId = req.session.user.id;

        // Verify the feedback belongs to the logged-in student
        const [rows] = await db.execute(
            `SELECT f.id, f.course_id, f.teaching_rating, f.content_rating, 
                    f.difficulty_rating, f.overall_rating, f.comments,
                    c.course_code, c.course_name, c.teacher_name
             FROM feedback f
             JOIN courses c ON f.course_id = c.id
             WHERE f.id = ? AND f.student_id = ?`,
            [feedbackId, studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Feedback not found.' 
            });
        }

        res.json({ success: true, feedback: rows[0] });

    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch feedback.' });
    }
});

// ── EDIT/UPDATE FEEDBACK ───────────────────
// PUT /feedback/edit/:feedbackId
// Receives: { teaching_rating, content_rating, difficulty_rating, overall_rating, comments }
router.put('/edit/:feedbackId', requireStudentLogin, async (req, res) => {
    try {
        const feedbackId = req.params.feedbackId;
        const studentId = req.session.user.id;
        const { teaching_rating, content_rating, difficulty_rating, overall_rating, comments } = req.body;

        // Validation
        if (!teaching_rating || !content_rating || !difficulty_rating || !overall_rating) {
            return res.status(400).json({ 
                success: false, 
                message: 'All rating fields are required.' 
            });
        }

        // All ratings must be between 1 and 5
        const ratings = [teaching_rating, content_rating, difficulty_rating, overall_rating];
        for (let r of ratings) {
            if (r < 1 || r > 5) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Ratings must be between 1 and 5.' 
                });
            }
        }

        // Comments max 500 characters
        if (comments && comments.length > 500) {
            return res.status(400).json({ 
                success: false, 
                message: 'Comments must be under 500 characters.' 
            });
        }

        // Verify feedback belongs to student
        const [verify] = await db.execute(
            'SELECT id FROM feedback WHERE id = ? AND student_id = ?',
            [feedbackId, studentId]
        );

        if (verify.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have permission to edit this feedback.' 
            });
        }

        // Update feedback
        await db.execute(
            `UPDATE feedback 
             SET teaching_rating = ?, content_rating = ?, difficulty_rating = ?, overall_rating = ?, comments = ?
             WHERE id = ? AND student_id = ?`,
            [teaching_rating, content_rating, difficulty_rating, overall_rating, comments || null, feedbackId, studentId]
        );

        res.json({ 
            success: true, 
            message: 'Feedback updated successfully!' 
        });

    } catch (error) {
        console.error('Edit feedback error:', error);
        res.status(500).json({ success: false, message: 'Could not update feedback.' });
    }
});

// ── DELETE FEEDBACK ────────────────────────
// DELETE /feedback/delete/:feedbackId
// Allows student to delete their own feedback
router.delete('/delete/:feedbackId', requireStudentLogin, async (req, res) => {
    try {
        const feedbackId = req.params.feedbackId;
        const studentId = req.session.user.id;

        // Verify feedback belongs to the student
        const [verify] = await db.execute(
            'SELECT id FROM feedback WHERE id = ? AND student_id = ?',
            [feedbackId, studentId]
        );

        if (verify.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have permission to delete this feedback.' 
            });
        }

        // Delete feedback
        const [result] = await db.execute(
            'DELETE FROM feedback WHERE id = ? AND student_id = ?',
            [feedbackId, studentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Feedback not found.' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Feedback deleted successfully!' 
        });

    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(500).json({ success: false, message: 'Could not delete feedback.' });
    }
});

module.exports = router;
