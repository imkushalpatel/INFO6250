const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const uuid = require('uuid');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

mongoose.connect('mongodb+srv://imkushalpatel:jATaBa7xMQvCUo7M@cluster0.hofxinc.mongodb.net/info6250');

const sessionSchema = new mongoose.Schema({
    _id: String,
    data: Object,
    expires: Date,
});

const Session = mongoose.model('Session', sessionSchema);

const TOKEN_SECRET = 'your-token-secret';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to check custom token and set session data
const tokenMiddleware = async (req, res, next) => {
    const token = req.headers.authorization;

    if (token) {
        try {
            // Verify and decode the token
            const decoded = verifyToken(token);

            // Check token expiration
            if (Date.now() > decoded.exp * 1000) {
                return res.status(403).json({ message: 'Token has expired' });
            }

            // Retrieve session data from MongoDB
            const sessionData = await Session.findById(decoded.sessionId).exec();

            // Set session data based on the retrieved data
            req.session = {
                data: sessionData.data,
                expiresAt: sessionData.expires.getTime(),
            };
        } catch (error) {
            return res.status(403).json({ message: 'Invalid token' });
        }
    }

    next();
};

// Function to verify and decode the custom token
const verifyToken = (token) => {
    const [header, payload, signature] = token.split('.');
    const verifiedSignature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64');

    if (verifiedSignature !== signature) {
        throw new Error('Invalid signature');
    }

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
    return { sessionId: decodedPayload.sessionId, exp: decodedPayload.exp };
};

// Middleware to create and set the custom token in the Authorization header
const setTokenMiddleware = async (req, res, next) => {
    const { username } = req.body;

    // Create a custom token with expiration time and signature
    const sessionId = uuid.v4();
    const payload = {
        sessionId,
        exp: Math.floor(Date.now() / 1000) + 1800, // Expires in 30 minutes
    };

    // Store session data in MongoDB
    const session = new Session({
        _id: sessionId,
        data: { username },
        expires: new Date(payload.exp * 1000),
    });
    await session.save();

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payloadBase64}`).digest('base64');

    const customToken = `${header}.${payloadBase64}.${signature}`;
    req.token = customToken;

    next();
};

app.use(tokenMiddleware);

app.get('/', (req, res) => {
    res.send('Hello, welcome to the homepage!');
});

app.get('/profile', (req, res) => {
    const username = req.session.data.username || 'Guest';
    res.send(`Welcome, ${username}!`);
});

app.post('/login', setTokenMiddleware, (req, res) => {
    const { username } = req.body;

    res.json({ message: `Successfully logged in as ${username}`, token: req.token });
});

app.get('/example-route', (req, res) => {
    const username = req.session.data.username || 'Guest';
    res.send(`Welcome, ${username}!`);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
