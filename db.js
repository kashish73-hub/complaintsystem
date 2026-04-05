// ============================================
// db.js - Database Connection Module
// ============================================
// This file creates a reusable MySQL connection pool.
// A "pool" is better than a single connection because
// it handles multiple requests at the same time efficiently.
// ============================================

const mysql = require('mysql2');

// Create a connection pool with your MySQL credentials
const pool = mysql.createPool({
    host: 'localhost',          // MySQL server address
    user: 'root',               // Your MySQL username
    password: '1234',               // Your MySQL password (change if set)
    database: 'feedback_system',// Database name we created in schema.sql
    waitForConnections: true,   // Wait if all connections are busy
    connectionLimit: 10,        // Max 10 simultaneous connections
    queueLimit: 0               // Unlimited queue
});

// Convert pool to use Promises (async/await syntax)
// This makes our database queries cleaner to write
const promisePool = pool.promise();

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection FAILED:', err.message);
        console.log('   → Check your MySQL username/password in db.js');
        console.log('   → Make sure MySQL server is running');
    } else {
        console.log('✅ Database connected successfully!');
        connection.release(); // Always release connections back to pool
    }
});

// Export the pool so other files can use it
module.exports = promisePool;
