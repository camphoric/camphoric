const chalk = require('chalk');
const child_process = require('child_process');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const mkdirp = require('mkdirp');
const os = require('os');
const path = require('path');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

module.exports = async function() {
  console.log(chalk.green('Setup Puppeteer'));
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--single-process',
      '--no-zygote',
      '--use-gl=swiftshader',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ]
  });
  // This global is not available inside tests but only in global teardown
  global.__BROWSER_GLOBAL__ = browser;

  // Instead, we expose the connection details via file system to be used in tests
  mkdirp.sync(DIR);
  fs.writeFileSync(path.join(DIR, 'wsEndpoint'), browser.wsEndpoint());
}
