const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const uuid = require('uuid');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const sessionSchema = new mongoose.Schema({
    _id: String,
    data: Object,
    expires: Date,
});

const Session = mongoose.model('Session', sessionSchema);

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'your-default-token-secret';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Middleware to check custom token and set session data
const tokenMiddleware = async (req, res, next) => {
    const token = req.headers.authorization;

    if (token) {
        try {
            // Verify and decode the token
            const decoded = verifyToken(token);

            // Retrieve session data from MongoDB based on the session ID
            const sessionData = await Session.findById(decoded.sessionId).exec();

            // Check token expiration
            if (!sessionData || Date.now() > sessionData.expires.getTime()) {
                return res.status(403).json({ message: 'Token has expired or is invalid' });
            }

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
    return { sessionId: decodedPayload.sessionId };
};

// Middleware to create and set the custom token in the Authorization header
const setTokenMiddleware = async (req, res, next) => {
    const { username } = req.body;

    // Create a custom token with only the session ID
    const sessionId = uuid.v4();
    const payload = {
        sessionId,
    };

    // Store session data in MongoDB
    const session = new Session({
        _id: sessionId,
        data: { username },
        expires: new Date(Date.now() + 30 * 60 * 1000), // Expires in 30 minutes
    });
    await session.save();

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payloadBase64}`).digest('base64');

    const customToken = `${header}.${payloadBase64}.${signature}`;

    // Attach the token to the response object
    req.customToken = customToken;

    next();
};

app.use(tokenMiddleware);

app.post('/login', setTokenMiddleware, (req, res) => {
    const { username } = req.body;

    // Send a response with the success message and attach the token
    res.json({ message: `Successfully logged in as ${username}`, token: req.customToken });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
