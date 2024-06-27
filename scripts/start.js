const chokidar = require('chokidar');
const { exec } = require('child_process');

const watcher = chokidar.watch('.', {
  ignored: /node_modules|\.git/,
  persistent: true
});

watcher.on('ready', () => {
  console.log('Initial scan complete. Ready for changes.');
  exec('npm run dev', (err, stdout, stderr) => {
    if (err) {
      console.error(`exec error: ${err}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
});

watcher.on('all', (event, path) => {
  console.log(event, path);
});
