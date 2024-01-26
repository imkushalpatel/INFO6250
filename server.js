const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const Joi = require('joi');

const app = express();
const port = 3000;

app.use(bodyParser.json());
// app.use(cors());
app.use(cors({ credentials: true, origin: "http://127.0.0.1:5500" }));


app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
}));

const originalQuestions = ["Question 1", "Question 2", "Question 3"]; // Replace with your actual questions

app.get('/api/questions', (req, res) => {
    const sessionAnswers = req.session.answers || [];
    req.session.index = req.session.index || 0;

    if (req.session.index >= originalQuestions.length) {
        return res.json({ question: 'No more questions', status: true, index: req.session.index, total: originalQuestions.length });
    }

    const question = originalQuestions[req.session.index];

    return res.json({ question, status: false, index: req.session.index, total: originalQuestions.length });
});

const schema = Joi.object({
    answer: Joi.string().trim().min(1).max(50).required(),
});


app.post('/api/submit', (req, res) => {

    const { error, value } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    const answer = req.body.answer;
    req.session.index = req.session.index || 0;
    req.session.answers = req.session.answers || [];

    if (req.session.index >= originalQuestions.length) {
        return res.json({ question: 'No more questions', status: true, index: req.session.index, total: originalQuestions.length });
    }
    req.session.answers.push(answer);

    req.session.index++;


    const totalQuestions = originalQuestions.length;
    const count = req.session.answers.length;

    const response = {
        status: count >= totalQuestions,
        question: originalQuestions[req.session.index] || 'No more questions',
        index: req.session.index,
        total: totalQuestions,
    };

    return res.json(response);
});

app.get('/api/review', (req, res) => {
    const sessionAnswers = req.session.answers || [];
    const review = originalQuestions.map((question, index) => ({ question, answer: sessionAnswers[index] }));
    res.json({ review });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
