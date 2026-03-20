require('dotenv').config();
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const SECRET = process.env.WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://127.0.0.1:9000/webhook';
const PROJECT = process.env.TEST_PROJECT_NAME || 'your_project';

if (!SECRET) {
  console.error('ERROR: WEBHOOK_SECRET is not set in .env');
  process.exit(1);
}

const payload = JSON.stringify({
  ref: 'refs/heads/master',
  repository: {
    name: PROJECT
  }
});

const signature = 'sha256=' + crypto
  .createHmac('sha256', SECRET)
  .update(payload)
  .digest('hex');

console.log(`Sending test webhook for project: ${PROJECT}`);
console.log(`Target URL: ${WEBHOOK_URL}`);

const parsedUrl = new URL(WEBHOOK_URL);
const client = parsedUrl.protocol === 'https:' ? https : http;

const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port,
  path: parsedUrl.pathname + parsedUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-GitHub-Event': 'push',
    'X-Hub-Signature-256': signature
  }
};

const req = client.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
    if (res.statusCode === 200) {
      console.log('Success! Check your deploy logs for progress.');
    } else {
      console.log('Failed. Check if the deploy server is running and the secret matches.');
    }
  });
});

req.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

req.write(payload);
req.end();
