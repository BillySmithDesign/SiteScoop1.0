const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

app.post('/api/download', (req, res) => {
  const { url } = req.body;
  const outputDir = path.resolve(__dirname, 'downloads');
  const siteScoopScriptPath = path.resolve(__dirname, 'SiteScoop.js'); // Path to SiteScoop script
  const downloadPath = path.join(outputDir, 'site.zip');

  exec(`node ${siteScoopScriptPath} ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${stderr}`);
      return res.status(500).json({ message: 'Failed to download the website' });
    }

    const output = fs.createWriteStream(downloadPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`${archive.pointer()} total bytes`);
      console.log('Archiver has been finalized and the output file descriptor has closed.');
      res.status(200).json({ message: 'Website downloaded successfully!', downloadLink: '/downloads/site.zip' });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(outputDir, false);
    archive.finalize();
  });
});

app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
