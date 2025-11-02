// migrate.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env file
require('dotenv').config();

const logFile = path.join(__dirname, 'analytics.json');

// --- 1. Setup Database Connection ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon
    }
});

// --- 2. Read JSON File ---
async function migrateData() {
    let analyticsData = [];
    try {
        if (fs.existsSync(logFile)) {
            const data = fs.readFileSync(logFile, 'utf8');
            analyticsData = JSON.parse(data);
            console.log(`Loaded ${analyticsData.length} events from analytics.json.`);
        } else {
            console.error('analytics.json file not found. Nothing to migrate.');
            return;
        }
    } catch (err) {
        console.error('Error reading or parsing analytics.json:', err);
        return;
    }

    if (analyticsData.length === 0) {
        console.log('No data to migrate.');
        return;
    }

    // --- 3. Insert Data into Postgres ---
    const client = await pool.connect();
    console.log('Connected to database. Starting migration...');

    let successfulInserts = 0;
    let failedInserts = 0;

    for (const event of analyticsData) {
        const query = `
            INSERT INTO analytics_events(type, song, artist, duration_ms, session_id, client_timestamp)
            VALUES($1, $2, $3, $4, $5, $6)
        `;
        
        // Map JSON data to DB columns
        const values = [
            event.type,
            event.song,
            event.artist || 'Unknown', // Handle missing artist field
            event.duration,            // This maps to 'duration_ms' in your DB
            event.sessionId,
            event.timestamp 
        ];

        try {
            await client.query(query, values);
            successfulInserts++;
        } catch (err) {
            console.error(`Failed to insert event for song: ${event.song}`, err.message);
            failedInserts++;
        }
    }

    // --- 4. Release Connection and Report ---
    client.release();
    console.log('--- Migration Complete ---');
    console.log(`Successfully inserted: ${successfulInserts} events.`);
    console.log(`Failed to insert: ${failedInserts} events.`);
    
    await pool.end(); // Close the connection pool
}

// Run the migration
migrateData().catch(err => {
    console.error('An unexpected error occurred:', err);
    pool.end();
});