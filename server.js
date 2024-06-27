const express = require('express');
const next = require('next');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const server = express();

server.use(bodyParser.json());

server.post('/api/download', (req, res) => {
  const { url } = req.body;
  const scriptPath = path.resolve(__dirname, 'server/SiteScoop.js'); // Path to SiteScoop script

  exec(`node ${scriptPath} ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${stderr}`);
      return res.status(500).json({ message: 'Failed to download the website' });
    }
    console.log(`Output: ${stdout}`);
    res.status(200).json({ message: 'Website downloaded successfully!', downloadLink: '/downloads/site.zip' });
  });
});

server.all('*', (req, res) => {
  return handle(req, res);
});

app.prepare().then(() => {
  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
}).catch((err) => {
  console.error('Error preparing Next.js app:', err);
});

module.exports = server;
