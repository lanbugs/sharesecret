require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { connect } = require('./db');
const Sharesecret = require('./models/Sharesecret');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const app = express();

app.use(helmet({
    strictTransportSecurity: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: null,
        },
    },
}));

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    message: { error: 'Too many secrets created, try again later' },
});

const readLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { error: 'Too many requests' },
});

app.post('/api/shares', createLimiter, async (req, res) => {
    const { encryptedSecret, iv, days } = req.body;

    if (!encryptedSecret || !iv || typeof encryptedSecret !== 'string' || typeof iv !== 'string') {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const expiryDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const share = await Sharesecret.create({
        _id: crypto.randomUUID(),
        encryptedSecret,
        iv,
        expiresAt,
    });

    res.status(201).json({ id: share._id });
});

app.get('/api/shares/:id', readLimiter, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
        return res.status(404).json({ error: 'Secret not found or already viewed' });
    }

    const share = await Sharesecret.findByIdAndDelete(req.params.id);

    if (!share) {
        return res.status(404).json({ error: 'Secret not found or already viewed' });
    }

    res.json({ encryptedSecret: share.encryptedSecret, iv: share.iv });
});

app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

connect().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
