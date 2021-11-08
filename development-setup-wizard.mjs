#!/usr/bin/env node --no-warnings

/**
 * Development setup wizard
 *
 * This script leads you through the steps required to get a working
 * develompent version of camphoric up and running.  It should reflect what is
 * in the doc/development.md file.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import util from 'util';
import childProc from 'child_process';

const exec = util.promisify(childProc.exec);

async function main() {
  await checkPrereqs();
  await createEnvFiles();
  await checkNodeModulesFolder();
  await dockerComposeUp();
  await setEnvValues();
  await createDjangoSuperUser();
  await loadSampleData();
  await runTests();
  await finish();
}

async function checkPrereqs() {
  const requiredCommands = ['docker', 'docker-compose'];

  await Promise.all(requiredCommands.map(async (cmd) => {
    try {
      await exec(`which "${cmd}"`);
    } catch (e) {
      die(
        `required command '${cmd}' could not be found!`,
        'please make sure that you have it installed and try again',
      );
    }
  }));

  hooray('Found all requirements');
}


async function createEnvFiles() {
  const dir = './env';
  let envDir;

  try {
    envDir = await fs.stat(dir);
  } catch (e) {
    envDir = { isDirectory: () => false };
  }

  if (envDir.isDirectory()) {
    const { blowaway } = await inquirer.prompt([{
      name: 'blowaway',
      type: 'confirm',
      message: `it looks like '${dir}' already exists, do you want to blow it away and start over?`,
    }]);

    if (!blowaway) return;

    await fs.rm(dir, { recursive: true, force: true });
  }

  // fs.cp is an experimental feature; when it's not experimental, use next line
  // await fs.cp('./.env.example', dir, { recursive: true, force: true });
  const localDir = `${dir}/local`;
  const exampleDir = `./.env.example/local`;
  await fs.mkdir(localDir, { recursive: true });

  const files = await fs.readdir(exampleDir);
  await Promise.all(
    files.map(f => fs.copyFile(`${exampleDir}/${f}`, `${localDir}/${f}`))
  );


  hooray('Successfully created env files');
}

async function checkNodeModulesFolder() {
  const dir = './client/node_modules';
  let nodeModulesFiles;

  try {
    nodeModulesFiles = await fs.readdir(dir);
  } catch (e) {
    nodeModulesFiles = [];
  }

  if (nodeModulesFiles.length) {
    const { blowaway } = await inquirer.prompt([{
      name: 'blowaway',
      type: 'confirm',
      message: `it looks like '${dir}' is not empty, do you want to blow it away and start over?`,
    }]);

    if (blowaway) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  hooray(`Checking of ${dir} completed`);
}


function dockerComposeUp() {
  console.log(chalk.bold('(Re)building docker containers'));
  return new Promise((resolve, reject) => {
    const ret = {
      stderr: '',
      stdout: '',
      code: undefined,
      signal: undefined,
    };

    const cmd = 'docker-compose';
    const args = ['up', '--build', '-d'];
    const child = childProc.spawn(cmd, args, { stdio: 'inherit', shell: true });

    child.addListener('error', reject);
    child.addListener('close', (code, signal) => {
      ret.code = code;
      ret.signal = signal;
    });

    child.addListener('exit', (code, signal) => {
      resolve(ret);

      hooray('Successfully built and started docker containers');
    });
  });
}


// for now, no customization, we're keeping it simple
async function setEnvValues() {
  const filename = './env/local/django.env';
  let contents = await fs.readFile(filename, 'utf-8').then(c => c.toString().trim());

  let currentKey = '';
  const currentKeyPair = contents
    .split(/[\r\n]+/g)
    .find(s => s.includes('SECRET_KEY='));
  
  // check if the SECRET_KEY value exists and set it to the default if so
  if (currentKeyPair) {
    currentKey = currentKeyPair.split('=')[1];
  } else {
    currentKey = 'your-django-secret-key-here';
    contents += '\nSECRET_KEY=your-django-secret-key-here';
  }
  
  if (currentKey !== 'your-django-secret-key-here') {
    const { replaceKey } = await inquirer.prompt([{
      name: 'replaceKey',
      type: 'confirm',
      message: `it looks like there is already a SECRET_KEY in your ${filename} file. Do you want replace it with a newly generated one?`,
    }]);

    if (!replaceKey) return;
  }

  const secretKey = await getSecretKey();

  contents = contents.replace(/SECRET_KEY=.*/, `SECRET_KEY='${secretKey}'`);
  await fs.writeFile(filename, contents, 'utf-8');
  hooray(`Successfully wrote secret key to ${filename}`);
	
	// Rebuild if we added secret key
	await dockerComposeUp();
}

async function getSecretKey() {
  const cmd = 'docker-compose exec -T django python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"';
  const result = await exec(cmd);

  const secretKey = result.stdout.trim().replace(/'/g, '\\\'');

  if (!secretKey) {
    die(
      'Could not successfully get secret key',
      `tried '${cmd}'`,
      result.stderr,
    );
  } else {
    hooray('Successfully got secret key');
  }

  return secretKey;
}


async function createDjangoSuperUser() {
  console.log(chalk.bold('Create your Django superuser:'));
  await spawn(
    'docker-compose',
    ['exec', 'django', 'python', 'manage.py', 'createsuperuser'],
  );
}


async function loadSampleData() {
  console.log(chalk.bold('Loading BACDS Family Week sample data...'));
  await exec(
    'docker-compose exec -T django bash -c "./manage.py loaddata fixtures/familyweek-seed-data.json"'
  );

  hooray('Successfully loaded BACDS Family Week sample data');

  console.log(chalk.bold('Loading Lark Camp sample data...'));
  console.log('You will need to use your superuser credentials');
  console.log('to complete this task');

  await spawn(
    'docker-compose',
    ['exec', 'react', 'node', 'fixtures/lark/loadData.mjs'],
  );

  hooray('Successfully loaded Lark Camp sample data');
}


async function runTests() {
  console.log(chalk.bold('Running backend tests'));

  const results = await spawn(
    'docker-compose',
    ['exec', 'django', 'python', 'manage.py', 'test'],
  );

  if (results.code) {
    console.log(chalk.bold.red('Backend tests failed!'));
    [
      'Although the process of setting up your development environment',
      'succeeded, please try to find out why these test failures',
      'happened and run the tests again.',
    ].forEach(s => console.log(chalk.bold(s)));
  } else {
    hooray('Backend tests pass');
  }
}


async function finish() {
  hooray('Development environment setup finished!');
  
  [
    'For more information, see the following resources:',
    '  https://github.com/camphoric/camphoric/blob/main/doc/development.md#frontend-development-process',
    '  https://github.com/camphoric/camphoric/blob/main/doc/development.md#server-development-process',
    '',
    'To see your glorious work in action go to:',
    '  http://localhost:3000',
  ].forEach(s => console.log(s));
}

function die(title, ...msgs) {
  console.log(chalk.bold.red(title));

  msgs.forEach(m => console.log(chalk.bold(m)));

  process.exit(1);
}

function hooray(title, ...msgs) {
  console.log(chalk.bold.green(`✅ ${title}`));

  if (msgs.length) console.log(...msgs);
}

function spawn(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const ret = {
      stderr: '',
      stdout: '',
      code: undefined,
      signal: undefined,
    };

    const child = childProc.spawn(cmd, args, { stdio: 'inherit', shell: true, ...options });

    child.stdout && child.stdout.on('data', (data) => (ret.stdout += data));

    child.stderr && child.stderr.on('data', (data) => (ret.stderr += data));

    child.addListener('error', reject);
    child.addListener('close', (code, signal) => {
      ret.code = code;
      ret.signal = signal;

      resolve(ret);
    });

    child.addListener('exit', (code, signal) => {
      ret.code = code;
      ret.signal = signal;

      resolve(ret);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
