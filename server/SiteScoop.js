const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const url = require('url');
const sharp = require('sharp');

// Configuration
const BASE_URL = process.argv[2]; // The URL to download passed as a command line argument
const OUTPUT_DIR = path.resolve(__dirname, 'downloads');

// Utility to create directories recursively
const mkdirSyncRecursive = (dir) => {
  if (fs.existsSync(dir)) {
    return;
  }
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      mkdirSyncRecursive(path.dirname(dir)); // Create parent directories
      mkdirSyncRecursive(dir); // Create the directory
    }
  }
};

// Utility to write files with proper directories
const writeFileSyncRecursive = (filename, content) => {
  mkdirSyncRecursive(path.dirname(filename));
  fs.writeFileSync(filename, content);
};

// Function to download static assets
const downloadAsset = async (page, assetUrl, outputDir) => {
  const parsedUrl = url.parse(assetUrl);
  let filePath = path.join(outputDir, parsedUrl.pathname);
  mkdirSyncRecursive(path.dirname(filePath));

  try {
    const response = await page.goto(assetUrl);
    if (response.ok()) {
      const buffer = await response.buffer();
      fs.writeFileSync(filePath, buffer);
    }
  } catch (error) {
    console.error(`Failed to download ${assetUrl}: ${error}`);
  }
};

// Function to convert SVG or data string images to PNG
const convertSvgToPng = async (inputBuffer, outputPath) => {
  try {
    await sharp(inputBuffer)
      .png()
      .toFile(outputPath);
  } catch (error) {
    console.error(`Failed to convert SVG to PNG: ${error}`);
  }
};

// Function to remove tracking scripts and cookies from HTML content
const cleanHtmlContent = (html) => {
  // Remove Google Analytics and Tag Manager scripts
  html = html.replace(/<script[^>]*src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^>]*><\/script>/g, '');
  html = html.replace(/<script[^>]*src=["']https:\/\/www\.googletagmanager\.com\/gtm\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script[^>]*>[\s\S]*?(?:gtag|googletagmanager)[\s\S]*?<\/script>/g, '');

  // Remove other tracking scripts by common patterns
  html = html.replace(/<script[^>]*>[\s\S]*?(?:_gaq|_gat|ga\().*?<\/script>/g, '');

  // Remove cookies related to tracking
  html = html.replace(/document\.cookie\s*=\s*["'][^"']*["'];?/g, '');

  return html;
};

// Main function
(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const visited = new Set();
  const toVisit = new Set([BASE_URL]);

  while (toVisit.size > 0) {
    const currentUrl = Array.from(toVisit)[0];
    toVisit.delete(currentUrl);

    if (visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    await page.goto(currentUrl, { waitUntil: 'networkidle2' });

    let pageContent = await page.content();
    pageContent = cleanHtmlContent(pageContent); // Clean the HTML content

    const parsedUrl = url.parse(currentUrl);
    let filePath = path.join(OUTPUT_DIR, parsedUrl.pathname);

    if (parsedUrl.pathname.endsWith('/')) {
      filePath += 'index.html';
    } else if (!parsedUrl.pathname.includes('.')) {
      filePath += '.html';
    }

    // Save the cleaned HTML content
    writeFileSyncRecursive(filePath, pageContent);

    // Extract and queue new links
    const links = await page.$$eval('a', anchors => anchors.map(anchor => anchor.href));
    links.forEach(link => {
      const parsedLink = url.parse(link);
      if (parsedLink.hostname === parsedUrl.hostname) {
        const absoluteLink = url.resolve(BASE_URL, parsedLink.pathname);
        if (!visited.has(absoluteLink)) {
          toVisit.add(absoluteLink);
        }
      }
    });

    // Download assets (images, CSS, JS)
    const assets = await page.$$eval('link, script, img', elements => elements.map(element => element.src || element.href).filter(Boolean));
    for (const assetUrl of assets) {
      await downloadAsset(page, assetUrl, OUTPUT_DIR);
    }

    // Convert SVG or data string images to PNG
    const images = await page.$$eval('img', imgs => imgs.map(img => img.src));
    for (const imgUrl of images) {
      if (imgUrl.startsWith('data:image/svg+xml') || imgUrl.endsWith('.svg')) {
        const response = await page.goto(imgUrl);
        if (response.ok()) {
          const buffer = await response.buffer();
          const outputPath = path.join(OUTPUT_DIR, parsedUrl.pathname, 'image.png');
          await convertSvgToPng(buffer, outputPath);
        }
      }
    }
  }

  await browser.close();
})();
