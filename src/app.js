// Minimal web app with zero dependencies (Node's built-in http module).
const http = require('http');

const VERSION = process.env.APP_VERSION || 'dev';

function handler(req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'UP', version: VERSION }));
  }
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(
      `<h1>Hello from Jenkins CI/CD!</h1><p>Build version: <b>${VERSION}</b></p><p>Deployed automatically by Jenkins!</p>`
    );
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

function createServer() {
  return http.createServer(handler);
}

module.exports = { createServer, handler };
