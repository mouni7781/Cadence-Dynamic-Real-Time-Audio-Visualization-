const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

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

app.use('/Songs', express.static(path.join(__dirname, 'Songs')));

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 