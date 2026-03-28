const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'db.json');
const ADMIN_SECRET_CODE = 'PRYSMIS_2026';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], admins: [] }, null, 2));
}

app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/stats', (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        res.json({
            users: db.users.length,
            projects: db.users.reduce((sum, user) => sum + (user.projects || 0), 0)
        });
    } catch (err) {
        res.json({ users: 0, projects: 0 });
    }
});

app.post('/account', (req, res) => {
    const { username, password } = req.body;
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        if (db.users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already taken.' });
        }

        const newUser = { 
            username, 
            password, 
            projects: 0,
            token: 'prysmis_' + Math.random().toString(36).substr(2, 12)
        };

        db.users.push(newUser);
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

        res.json({ success: true, username: newUser.username, token: newUser.token });
    } catch (err) {
        res.status(500).json({ error: 'Server database error.' });
    }
});

app.post('/admin/create', (req, res) => {
    const { username, password, code } = req.body;
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        if (code !== ADMIN_SECRET_CODE) {
            return res.status(403).json({ error: 'Invalid admin code.' });
        }

        const newAdmin = { 
            username, 
            password, 
            role: 'admin',
            token: 'admin_' + Math.random().toString(36).substr(2, 12)
        };

        db.admins.push(newAdmin);
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

        res.json({ success: true, username: newAdmin.username, token: newAdmin.token });
    } catch (err) {
        res.status(500).json({ error: 'Server database error.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
