const express = require('express');
const app = express();

app.get('/connect', (req, res) => {
    res.json({
        status: "connected",
        model: "PrysmisAI-v1"
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
