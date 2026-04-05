// ============================================
// routes/admin.js - Admin Dashboard Routes
// ============================================
// Handles: View all feedback, Statistics, Delete feedback
// Only admins can access these routes (middleware check)
// Key Concept: Aggregate SQL queries for analytics
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// ── MIDDLEWARE: Check if admin is logged in ──
function requireAdminLogin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Admin access required.' });
    }
}

// Apply admin check to ALL routes in this file
router.use(requireAdminLogin);

// ── GET DASHBOARD SUMMARY ──────────────────
// GET /admin/summary
// Returns key statistics for the dashboard
router.get('/summary', async (req, res) => {
    try {
        // Count total feedback submissions
        const [[{ totalFeedback }]] = await db.execute(
            'SELECT COUNT(*) AS totalFeedback FROM feedback'
        );

        // Count total registered students
        const [[{ totalStudents }]] = await db.execute(
            'SELECT COUNT(*) AS totalStudents FROM students'
        );

        // Count total courses
        const [[{ totalCourses }]] = await db.execute(
            'SELECT COUNT(*) AS totalCourses FROM courses'
        );

        // Overall average rating across all feedback
        const [[{ avgRating }]] = await db.execute(
            'SELECT ROUND(AVG(overall_rating), 2) AS avgRating FROM feedback'
        );

        // Count of each rating (1-5) for distribution chart
        const [ratingDist] = await db.execute(
            `SELECT overall_rating AS rating, COUNT(*) AS count 
             FROM feedback 
             GROUP BY overall_rating 
             ORDER BY overall_rating`
        );

        res.json({ 
            success: true, 
            summary: { totalFeedback, totalStudents, totalCourses, avgRating },
            ratingDistribution: ratingDist
        });

    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch summary.' });
    }
});

// ── GET ALL FEEDBACK ───────────────────────
// GET /admin/all-feedback?page=1&limit=10&course_id=&min_rating=
// Returns paginated list of all feedback with filters
router.get('/all-feedback', async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Filter parameters
        const courseId = req.query.course_id || null;
        const minRating = parseInt(req.query.min_rating) || 1;

        // Build dynamic WHERE clause based on filters
        let whereClause = 'WHERE f.overall_rating >= ?';
        let params = [minRating];

        if (courseId) {
            whereClause += ' AND f.course_id = ?';
            params.push(courseId);
        }

        // Main query: joins feedback + students + courses tables
        const [rows] = await db.execute(
            `SELECT f.id, f.teaching_rating, f.content_rating, 
                    f.difficulty_rating, f.overall_rating, f.comments, f.submitted_at,
                    s.name AS student_name, s.roll_number,
                    c.course_code, c.course_name, c.teacher_name, c.department
             FROM feedback f
             JOIN students s ON f.student_id = s.id
             JOIN courses c ON f.course_id = c.id
             ${whereClause}
             ORDER BY f.submitted_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Count total records for pagination
        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM feedback f ${whereClause}`,
            params
        );

        res.json({ 
            success: true, 
            feedback: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('All feedback error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch feedback.' });
    }
});

// ── GET COURSE-WISE STATISTICS ─────────────
// GET /admin/course-stats
// Returns average ratings per course (for comparison)
router.get('/course-stats', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT 
                c.id,
                c.course_code,
                c.course_name,
                c.teacher_name,
                c.department,
                c.semester,
                COUNT(f.id) AS total_responses,
                ROUND(AVG(f.teaching_rating), 2) AS avg_teaching,
                ROUND(AVG(f.content_rating), 2) AS avg_content,
                ROUND(AVG(f.difficulty_rating), 2) AS avg_difficulty,
                ROUND(AVG(f.overall_rating), 2) AS avg_overall
             FROM courses c
             LEFT JOIN feedback f ON c.id = f.course_id
             GROUP BY c.id, c.course_code, c.course_name, c.teacher_name, c.department, c.semester
             ORDER BY avg_overall DESC`
        );

        res.json({ success: true, courseStats: rows });

    } catch (error) {
        console.error('Course stats error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch course stats.' });
    }
});

// ── GET ALL COURSES ────────────────────────
// GET /admin/courses
router.get('/courses', async (req, res) => {
    try {
        const [courses] = await db.execute(
            'SELECT * FROM courses ORDER BY semester, course_code'
        );
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch courses.' });
    }
});

// ── DELETE FEEDBACK ────────────────────────
// DELETE /admin/feedback/:id
// Removes a specific feedback entry (READ + DELETE operations)
router.delete('/feedback/:id', async (req, res) => {
    try {
        const feedbackId = req.params.id;

        const [result] = await db.execute(
            'DELETE FROM feedback WHERE id = ?',
            [feedbackId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Feedback not found.' });
        }

        res.json({ success: true, message: 'Feedback deleted successfully.' });

    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(500).json({ success: false, message: 'Could not delete feedback.' });
    }
});

// ── GET ALL STUDENTS ───────────────────────
// GET /admin/students
router.get('/students', async (req, res) => {
    try {
        const [students] = await db.execute(
            `SELECT s.id, s.name, s.roll_number, s.email, s.department, s.semester,
                    COUNT(f.id) AS feedback_count
             FROM students s
             LEFT JOIN feedback f ON s.id = f.student_id
             GROUP BY s.id, s.name, s.roll_number, s.email, s.department, s.semester
             ORDER BY s.roll_number`
        );
        res.json({ success: true, students });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch students.' });
    }
});

module.exports = router;
