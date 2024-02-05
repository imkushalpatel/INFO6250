const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const uuid = require('uuid');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI);

const sessionSchema = new mongoose.Schema({
    _id: String,
    data: Object,
    expires: Date,
});

const Session = mongoose.model('Session', sessionSchema);

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'your-default-token-secret';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const extendSession = async (sessionId) => {
    try {
        const session = await Session.findById(sessionId).exec();

        if (session) {
            // Check if there are 5 minutes or less remaining
            const remainingTime = session.expires - Date.now();
            if (remainingTime <= 5 * 60 * 1000) {
                // Extend the session expiry by 10 minutes
                session.expires = new Date(session.expires.getTime() + 10 * 60 * 1000);
                await session.save();
                console.log(`Session extended for session ID: ${sessionId}`);
            } else {
                console.log(`No need to extend session for session ID: ${sessionId}`);
            }
        } else {
            console.log(`Session not found for session ID: ${sessionId}`);
        }
    } catch (error) {
        console.error(`Error extending session: ${error.message}`);
    }
};
const tokenMiddleware = async (req, res, next) => {
    const token = req.headers.authorization;

    if (token) {
        try {

            const decoded = verifyToken(token);


            const sessionData = await Session.findById(decoded.sessionId).exec();


            if (!sessionData || Date.now() > sessionData.expires.getTime()) {
                return res.status(403).json({ message: 'Token has expired or is invalid' });
            }


            req.session = {
                sessionId: decoded.sessionId,
                data: sessionData.data,
                expiresAt: sessionData.expires.getTime(),
            };

            extendSession(decoded.sessionId);
        } catch (error) {
            console.log(error);
            return res.status(403).json({ message: 'Invalid token' });
        }
    }

    next();
};


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


const setTokenMiddleware = async (req, res, next) => {
    const { username } = req.body;


    const sessionId = uuid.v4();
    const payload = {
        sessionId,
    };


    const session = new Session({
        _id: sessionId,
        data: { username },
        expires: new Date(Date.now() + 30 * 60 * 1000),
    });
    await session.save();

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payloadBase64}`).digest('base64');

    const customToken = `${header}.${payloadBase64}.${signature}`;


    req.customToken = customToken;

    next();
};

app.use(tokenMiddleware);

app.post('/login', setTokenMiddleware, (req, res) => {
    const { username } = req.body;


    res.json({ message: `Successfully logged in as ${username}`, token: req.customToken });
});

app.get('/profile', (req, res, next) => {
    const username = req.session && req.session.data.username || 'Guest';
    req.session.data.username = "hello";
    res.send(`Welcome, ${username}!`);
    next();
});


app.use(async (req, res, next) => {

    if (req.session && req.session.sessionId && req.session.data) {

        try {
            const { sessionId } = req.session;

            const session = await Session.findByIdAndUpdate(
                sessionId,
                { data: req.session.data },
                { new: true, upsert: false }
            );

            console.log(`Session data saved for session ID: ${sessionId}`);
        } catch (error) {
            console.error(`Error saving session data: ${error.message}`);
        }
    }

    next();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
