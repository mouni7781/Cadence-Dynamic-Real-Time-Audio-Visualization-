const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/Songs', express.static(path.join(__dirname, 'Songs')));

//  ANALYTICS DATA & REAL-TIME UPDATES --- #
const logFile = path.join(__dirname, 'analytics.json');
let analyticsData = [];
let clients = []; //  A list to keep track of all open dashboards

//  This function sends a "refresh" message to all open dashboards
function sendUpdateToClients() {
    console.log(`Sending update to ${clients.length} clients`);
    clients.forEach(client => {
        client.res.write('event: update\n');
        client.res.write(`data: ${new Date().toISOString()}\n\n`);
    });
}

try {
    if (fs.existsSync(logFile)) {
        //  Read the analytics.json file
        const data = fs.readFileSync(logFile, 'utf8');
        //  Load all the saved data into the analyticsData array
        analyticsData = JSON.parse(data);
        console.log(`Successfully loaded ${analyticsData.length} analytics events from ${logFile}.`);
    } else {
        console.log('No analytics.json file found, starting with empty data.');
    }
} catch (err) {
    console.error('Error reading or parsing analytics.json:', err);
    analyticsData = []; 
}

//************ API ENDPOINTS ************

//  [POST] Called by script.js every time a song is played, paused, etc.
app.post('/api/analytics/track', (req, res) => {
    const event = req.body;
    if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
    }
    
    //  1. Add new event to our array
    analyticsData.push(event);
    
    //  2. Save the array back to the file
    fs.writeFile(logFile, JSON.stringify(analyticsData, null, 2), (err) => {
        if (err) console.error('Failed to save analytics:', err);
    });
    
    console.log('Analytics event tracked:', event.type, event.song);
    
    //  3. Tell all open dashboards to refresh
    sendUpdateToClients();
    res.json({ success: true, message: 'Event tracked' });
});

//  [GET] This is the special real-time connection for the dashboard
app.get('/api/analytics/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res: res };
    // # <-- Add the new dashboard (client) to our list
    clients.push(newClient);
    console.log(`Client ${clientId} connected to SSE`);

    // # <-- When the dashboard closes, remove it from the list
    req.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        clients = clients.filter(client => client.id !== clientId);
    });
});

app.get('/api/analytics/stats', (req, res) => {
    const range = req.query.range || 'week';
    const now = Date.now();
    const ranges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
        all: Infinity
    };
    
    const cutoffTime = now - (ranges[range] || ranges.week);
    
    const filteredEvents = analyticsData.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= cutoffTime;
    });
    
    const stats = calculateStats(filteredEvents);
    res.json(stats);
});

function calculateStats(events) {
    const durationEvents = events.filter(e =>
        e.type === 'complete' ||
        e.type === 'skip' ||
        e.type === 'pause'
    );
    const playEvents = events.filter(e => e.type === 'play');
    const completeEvents = events.filter(e => e.type === 'complete');
    
    const totalTime = durationEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    
    const songCounts = {};
    playEvents.forEach(e => {
        songCounts[e.song] = (songCounts[e.song] || 0) + 1;
    });
    
    const topSongs = Object.entries(songCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([song, count]) => ({ name: song, plays: count }));
    
    const dailyStats = {};
    playEvents.forEach(e => {
        const date = new Date(e.timestamp).toLocaleDateString();
        if (!dailyStats[date]) {
            dailyStats[date] = { plays: 0, songs: new Set() };
        }
        dailyStats[date].plays++;
        dailyStats[date].songs.add(e.song);
    });
    
    let rate = 0;
    if (playEvents.length > 0) {
        rate = (completeEvents.length / playEvents.length) * 100;
    }

    return {
        totalPlays: playEvents.length,
        totalHours: (totalTime / (1000 * 60 * 60)).toFixed(1), 
        uniqueSongs: Object.keys(songCounts).length,
        topSongs: topSongs,
        dailyStats: Object.entries(dailyStats).map(([date, data]) => ({
            date,
            plays: data.plays,
            uniqueSongs: data.songs.size
        })),
        completionRate: rate.toFixed(1)
    };
}

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname,'public', 'analytics.html'));
});

app.get(/^\/api\/songs\/(.+)/, (req, res) => {
    const subfolder = req.params[0];
    const folderPath = path.join(__dirname, 'Songs', subfolder);

    if (!fs.existsSync(folderPath)) {
        console.error('Directory does not exist:', folderPath);
        return res.status(404).json({ error: 'Folder not found' });
    }

    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error("Could not list the directory:", err);
            return res.status(500).json({ error: 'Server error reading directory' });
        }

        const mp3Files = files.filter(file => file.endsWith('.mp3'));
        
        console.log('Found MP3 files:', mp3Files);
        res.json(mp3Files);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`📊 Analytics dashboard: http://localhost:${PORT}/analytics`);
});