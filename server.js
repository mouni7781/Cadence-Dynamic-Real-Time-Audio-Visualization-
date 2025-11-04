const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // Import the pg Pool
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add this at the top of server.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Check for API key
if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. AI features will be disabled.');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash"});

const pool = new Pool({
    // connectionString: process.env.DATABASE_URL ,
    connectionString: process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL ,
    ssl: {
        rejectUnauthorized: false // Required for Neon
    }
});

// This part stays the same: for real-time dashboard updates
let clients = []; 
function sendUpdateToClients() {
    console.log(`Sending update to ${clients.length} clients`);
    clients.forEach(client => {
        client.res.write('event: update\n');
        client.res.write(`data: ${new Date().toISOString()}\n\n`);
    });
}

//************ API ENDPOINTS ************

// [POST] Called by script.js. Now saves to Postgres.
app.post('/api/analytics/track', async (req, res) => {
    const event = req.body;
    
    const query = `
        INSERT INTO analytics_events(type, song, artist, duration_ms, session_id, client_timestamp)
        VALUES($1, $2, $3, $4, $5, $6)
    `;
    
    // Use the timestamp from the client, or default to now if missing
    const timestamp = event.timestamp || new Date().toISOString();
    
    try {
        await pool.query(query, [
            event.type,
            event.song,
            event.artist,
            event.duration, // from script.js, renamed to duration_ms in DB
            event.sessionId,
            timestamp
        ]);
        
        console.log('Analytics event tracked to DB:', event.type, event.song);

        if (event.type === 'complete' || event.type === 'skip') {
            sendUpdateToClients();
            console.log('Finished song event. Sending update to clients.');
        }
        res.json({ success: true, message: 'Event tracked' });
        
    } catch (err) {
        console.error('Failed to save analytics to DB:', err);
        res.status(500).json({ success: false, message: 'DB error' });
    }
});

// [GET] This is the special real-time connection (no change)
app.get('/api/analytics/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res: res };
    clients.push(newClient);
    console.log(`Client ${clientId} connected to SSE`);

    req.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        clients = clients.filter(client => client.id !== clientId);
    });
});

// [GET] Fetches stats. Now runs SQL queries.
app.get('/api/analytics/stats', async (req, res) => {
    const range = req.query.range || 'week';
    try {
        // All calculation logic is moved to the async calculateStats function
        const stats = await calculateStats(range);
        res.json(stats);
    } catch (err) {
        console.error('Failed to get stats:', err);
        res.status(500).json({ error: 'Failed to retrieve stats from database.' });
    }
});

// This function now runs all the SQL queries to get stats

async function calculateStats(range) {
    let interval;
    let dateFormat; // Flag for formatting logic

    switch (range) {
        case 'month': // Request 3: "last month"
            interval = '30 days';
            dateFormat = 'custom_week'; // <-- CHANGED from 'week'
            break;
        case 'year': // Request 2: "last year"
            interval = '1 year';
            dateFormat = 'month'; // Stays the same
            break;
        case 'all': // Request 1: "all time"
            interval = null; 
            dateFormat = 'all'; // Stays the same
            break;
        case 'week': // Request 4: "last week"
        default:
            interval = '7 days';
            dateFormat = 'day'; // Stays the same
    }

    // --- Base WHERE clauses (no change) ---
    const timeFilter = interval 
        ? `WHERE client_timestamp >= (NOW() - INTERVAL '${interval}')`
        : '';
    
    const playTimeFilter = `
        WHERE type = 'play'
        ${interval ? `AND client_timestamp >= (NOW() - INTERVAL '${interval}')` : ''}
    `;
    
    const durationTimeFilter = `
        WHERE type IN ('pause', 'skip', 'complete')
        ${interval ? `AND client_timestamp >= (NOW() - INTERVAL '${interval}')` : ''}
    `;

    // --- SQL Queries (Queries 1, 2, 3, 4, 6 are the same) ---
    
    const totalPlaysQuery = `SELECT COUNT(*) FROM analytics_events ${playTimeFilter}`;
    const totalHoursQuery = `SELECT SUM(duration_ms) AS total_ms FROM analytics_events ${durationTimeFilter}`;
    const uniqueSongsQuery = `SELECT COUNT(DISTINCT song) FROM analytics_events ${playTimeFilter}`;
    const topSongsQuery = `
        SELECT song AS name, COUNT(*) AS plays FROM analytics_events
        ${playTimeFilter}
        GROUP BY song
        ORDER BY plays DESC
        LIMIT 5
    `;
    const completionRateQuery = `
        SELECT
            COUNT(CASE WHEN type = 'play' THEN 1 END) AS total_plays,
            COUNT(CASE WHEN type = 'complete' THEN 1 END) AS total_completes
        FROM analytics_events
        ${timeFilter}
    `;

    // 5. Time-Series Stats (This query logic is now updated)
    let dailyStatsQuery;
    if (dateFormat === 'all') {
        // For 'all', we don't need time-series data.
        dailyStatsQuery = 'SELECT 1 WHERE 1=0;';
    
    // --- THIS BLOCK IS NEW ---
    } else if (dateFormat === 'custom_week') {
        // This is the new query for your "Month" view
        // It uses EXTRACT(DAY ...) and a CASE statement to group by your rules
        dailyStatsQuery = `
            SELECT
                CASE
                    WHEN EXTRACT(DAY FROM client_timestamp) <= 7 THEN 'Week 1'
                    WHEN EXTRACT(DAY FROM client_timestamp) <= 14 THEN 'Week 2'
                    WHEN EXTRACT(DAY FROM client_timestamp) <= 21 THEN 'Week 3'
                    WHEN EXTRACT(DAY FROM client_timestamp) <= 28 THEN 'Week 4'
                    ELSE 'Week 5'
                END AS date,
                COUNT(*) AS plays,
                COUNT(DISTINCT song) AS "uniqueSongs"
            FROM analytics_events
            ${playTimeFilter}
            GROUP BY date
            ORDER BY date ASC
        `;
    // --- END NEW BLOCK ---

    } else {
        // This handles 'week' (day) and 'year' (month)
        // 'dateFormat' will be 'day' or 'month'
        const dateTrunc = dateFormat; 
        dailyStatsQuery = `
            SELECT
                DATE_TRUNC('${dateTrunc}', client_timestamp)::DATE AS date,
                COUNT(*) AS plays,
                COUNT(DISTINCT song) AS "uniqueSongs"
            FROM analytics_events
            ${playTimeFilter}
            GROUP BY date
            ORDER BY date ASC
        `;
    }

    try {
        // Run all queries (no change)
        const [
            playsResult,
            hoursResult,
            uniqueResult,
            topSongsResult,
            dailyStatsResult,
            rateResult
        ] = await Promise.all([
            pool.query(totalPlaysQuery),
            pool.query(totalHoursQuery),
            pool.query(uniqueSongsQuery),
            pool.query(topSongsQuery),
            pool.query(dailyStatsQuery),
            pool.query(completionRateQuery)
        ]);

        // --- Process Results (Totals are the same) ---

        const totalPlays = parseInt(playsResult.rows[0].count, 10) || 0;
        const totalMs = parseInt(hoursResult.rows[0].total_ms, 10) || 0;
        const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(1);
        
        const uniqueSongs = parseInt(uniqueResult.rows[0].count, 10) || 0;
        
        const topSongs = topSongsResult.rows;

        let dailyStats = []; 

        // --- THIS PROCESSING LOGIC IS UPDATED ---
        if (dateFormat !== 'all') {
            dailyStats = dailyStatsResult.rows.map(row => {
                
                // If 'custom_week', the 'date' field is already "Week 1", etc.
                // The SQL query did all the work.
                if (dateFormat === 'custom_week') {
                    return row; // Return the row as-is
                }
                
                // This block handles 'day' and 'month'
                const date = new Date(row.date);
                let formattedDate;

                switch (dateFormat) {
                    case 'month': // For "year" range
                        formattedDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        break;
                    case 'day': // For "week" range
                    default:
                        formattedDate = date.toLocaleDateString();
                }
                
                return {
                    ...row,
                    date: formattedDate
                };
            });
        }
        // --- END UPDATED BLOCK ---

        const totalCompletes = parseInt(rateResult.rows[0].total_completes, 10) || 0;
        const rate = (totalPlays > 0) ? (totalCompletes / totalPlays) * 100 : 0;

        return {
            totalPlays,
            totalHours,
            uniqueSongs,
            topSongs,
            dailyStats,
            completionRate: rate.toFixed(1)
        };

    } catch (err) {
        console.error('Error executing stats queries:', err);
        throw err;
    }
}
app.post('/api/ai/artist-bio', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'AI service is not configured.' });
    }

    const { songName, artistName } = req.body;

    if (!artistName) {
        return res.status(400).json({ error: 'artistName is required' });
    }

    const prompt = `Write a short, 2-3 sentence biography for the music artist: "${artistName}". They are known for the song "${songName}". Focus on their genre and significance.`;

    try {
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({ bio: text });
    } catch (error) {
        console.error('AI Bio Error:', error);
        res.status(500).json({ error: 'Failed to generate AI content.' });
    }
});
// Serves the analytics dashboard HTML file
app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname,'public', 'analytics.html'));
});

// Export the app for the Netlify function
module.exports.app = app;