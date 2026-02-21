require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const express = require('express');

const config = require('./config.json');

const app = express();
const PORT = process.env.PORT || 9000;
const HOST = process.env.HOST || '127.0.0.1';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is not set - rejecting all webhooks');
    return false;
  }
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

function deploy(project, projectConfig) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `${project}-${timestamp}.log`);
  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.log(`[${project}] ${msg}`);
  };

  log(`Starting deploy for ${project}`);
  log(`Directory: ${projectConfig.path}`);

  for (const step of projectConfig.steps) {
    log(`Running: ${step}`);
    try {
      const output = execSync(step, {
        cwd: projectConfig.path,
        encoding: 'utf8',
        timeout: 300000,
      });
      if (output) log(output.trim());
    } catch (err) {
      log(`ERROR: ${err.message}`);
      if (err.stdout) log(`stdout: ${err.stdout}`);
      if (err.stderr) log(`stderr: ${err.stderr}`);
      return;
    }
  }

  log('Deploy complete');
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!verifySignature(req.body, signature)) {
    console.log('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }

  const event = req.headers['x-github-event'];
  if (event !== 'push') {
    return res.status(200).send('Ignored event: ' + event);
  }

  const payload = JSON.parse(req.body);
  const repoName = payload.repository.name;
  const branch = payload.ref.replace('refs/heads/', '');

  const projectConfig = config.projects[repoName];
  if (!projectConfig) {
    console.log(`No config found for repo: ${repoName}`);
    return res.status(200).send('No config for repo: ' + repoName);
  }

  if (branch !== projectConfig.branch) {
    console.log(`Ignoring push to ${branch} (configured: ${projectConfig.branch})`);
    return res.status(200).send('Ignored branch: ' + branch);
  }

  res.status(200).send('Deploying ' + repoName);

  setImmediate(() => deploy(repoName, projectConfig));
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, HOST, () => {
  console.log(`Deploy server listening on ${HOST}:${PORT}`);
  console.log(`Configured projects: ${Object.keys(config.projects).join(', ')}`);
});
