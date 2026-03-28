const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = 'db.json';
const ADMIN_SECRET_CODE = 'PRYSMIS_2026';

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], admins: [] }));
}

app.use(express.json());
app.use(express.static(__dirname));

app.post('/account', (req, res) => {
    const { username, password } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_FILE));

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
});

app.post('/admin/create', (req, res) => {
    const { username, password, code } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_FILE));

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
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
