const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Ensure this is installed: npm install node-fetch
require('dotenv').config(); // To access your REACT_APP_LA_TOKEN or LA_TOKEN

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('../client/build'));

// Proxy route to fetch LA open data with optional If-Modified-Since
app.get('/api/data', async (req, res) => {
    try {
        const apiUrl = `https://data.lacity.org/resource/e7h6-4a3e.json?$limit=5000`;

        const headers = {
            'X-App-Token': process.env.REACT_APP_LA_TOKEN || process.env.LA_TOKEN
        };

        // Pass along the If-Modified-Since header from the frontend if present
        if (req.headers['if-modified-since']) {
            headers['If-Modified-Since'] = req.headers['if-modified-since'];
        }

        const response = await fetch(apiUrl, { headers });

        // Forward the Last-Modified header back to the client
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
            res.set('Last-Modified', lastModified);
        }

        // Send status code and response body
        res.status(response.status);

        if (response.status === 304) {
            res.send(); // No content if not modified
        } else {
            const data = await response.text(); // Use text to avoid double-parsing
            res.send(data);
        }

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ message: 'Failed to fetch from external API' });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;