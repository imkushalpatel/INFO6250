const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

const server = http.createServer((req, res) => {
    const url = req.url === '/' ? '/survey.html' : req.url;
    const filePath = path.join(__dirname, url);

    if (req.method === 'GET') {
        if (url === '/api/questions') {
            // Serve survey questions
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const surveyQuestions = [
                'What is your favorite color?',
                'How often do you exercise?',
                'What is your Name?'
                // Add more questions as needed
            ];
            res.end(JSON.stringify({ questions: surveyQuestions }));
        } else {
            // Serve HTML page and other static files
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        }
    } else if (req.method === 'POST' && url === '/api/submit') {
        // Receive and summarize survey response in JSON format
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const surveyResponses = JSON.parse(body);
            // Add logic to summarize responses
            console.log('Survey Responses:', surveyResponses.answers);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: `Survey submitted successfully, ${surveyResponses.answers.q2}!` }));
        });
    }
});

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
