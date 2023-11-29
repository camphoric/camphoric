#!/usr/bin/env python3

"""
Development setup wizard

This script leads you through the steps required to get a working
development version of camphoric up and running.  It should reflect what is
in the doc/development.md file.  There are a few environment variables that
will affect the running of this script:

- CAMPHORIC_SETUP_WIZARD_RECREATE_ENV: if this is undef, it will prompt, if
  it is truthy, it will recreate, if it equals 'no', it will not recreate.
- CAMPHORIC_SETUP_WIZARD_RECREATE_SECRET_KEY: if this is undef, it will prompt, if
  it is truthy, it will recreate, if it equals 'no', it will not recreate.
"""


import argparse
import os
import os.path
import re
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(
        description=__doc__.strip(),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '-p',
        '--preserve',
        help='run non-destructively, non-interactively',
        action='store_true')
    args = parser.parse_args()

    check_prereqs(args)
    create_env_files(args)
    check_node_modules_folder(args)
    docker_compose_up(args)
    set_env_values(args)
    create_django_superuser(args)
    load_sample_data(args)
    run_tests(args)
    finish(args)


def check_prereqs(args):
    if not shutil.which('docker'):
        die(
            'required command `docker` not found!',
            'please make sure that you have it installed and try again')

    hooray('Found all requirements')


def create_env_files(args):
    if os.environ.get('CAMPHORIC_SETUP_WIZARD_RECREATE_ENV') == 'no':
        return

    if args.preserve:
        return

    dir_name = './env'
    if (os.path.isdir(dir_name)
            and 'CAMPHORIC_SETUP_WIZARD_RECREATE_ENV' not in os.environ):
        answer = input(' '.join([
            f'it looks like "{dir_name}" already exists,'
            'do you want to blow it away and start over? [y/n] ']))
        if answer.lower() != 'y':
            return

        shutil.rmtree(dir_name)

    shutil.copytree('./.env.example', dir_name)

    hooray('Successfully created env files')


def check_node_modules_folder(args):
    dir_name = './client/node_modules'
    contents = os.listdir(dir_name) if os.path.exists(dir_name) else []

    if args.preserve:
        return

    if len(contents):
        answer = input(' '.join([
            f'it looks like "${dir_name}" is not empty,'
            'do you want to blow it away and start over? [y/n] ']))
        if answer.lower() == 'y':
            shutil.rmtree(dir_name)

    hooray(f'Checking of {dir_name} completed')


def docker_compose_up(args):
    print(bold('(Re)building docker containers'))
    result = subprocess.run(['docker', 'compose', 'up', '--build', '-d'])
    if result.returncode != 0:
        die('failed to start docker containers')
    hooray('Successfully built and started docker containers')


def set_env_values(args):
    if os.environ.get('CAMPHORIC_SETUP_WIZARD_RECREATE_SECRET_KEY') == 'no':
        return

    filename = './env/local/django.env'
    contents = ''
    with open(filename) as f:
        contents = f.read().strip()

    current_key_pair = ''
    for line in re.split(r'[\r\n]+', contents):
        if line.startswith('SECRET_KEY='):
            current_key_pair = line
            break

    current_key = ''
    if current_key_pair:
        current_key = current_key_pair.split('=')[1]
    else:
        current_key = 'your-django-secret-key-here'
        contents += '\nSECRET_KEY=your-django-secret-key-here'

    if args.preserve:
        return

    if (current_key != 'your-django-secret-key-here'
            and 'CAMPHORIC_SETUP_WIZARD_RECREATE_SECRET_KEY' not in os.environ):
        answer = input(' '.join([
            f'it looks like there is already a SECRET_KEY in your {filename} file.',
            'Do you want replace it with a newly generated one? [y/n] ']))
        if answer.lower() != 'y':
            return

    secret_key = get_secret_key()
    contents = re.sub(r'SECRET_KEY=.*', f'SECRET_KEY={secret_key}', contents)
    with open(filename, 'w') as f:
        f.write(contents)
    hooray(f'Successfully wrote secret key to {filename}')

    # Rebuild if we added secret key
    docker_compose_up(args)


def get_secret_key():
    cmd = ' '.join([
        'docker compose exec -T django python -c',
        '"from django.core.management.utils import get_random_secret_key;',
        'print(get_random_secret_key())"'])
    result = subprocess.run(cmd, shell=True, capture_output=True)
    secret_key = (
        result.stdout.decode().strip()
        .replace("'", "\\'")
        .replace("$", "_"))  # django-environ uses $ for interpolation

    if not secret_key:
        die(
            "Could not successfully get secret key",
            f"tried '{cmd}'"
            f'\n{result.stderr.decode()}')
    else:
        hooray('Successfully got secret key')

    return secret_key


def create_django_superuser(args):
    print(bold('Create your Django superuser:'))
    subprocess.run([
        'docker', 'compose', 'exec', 'django',
        'python', 'manage.py', 'createsuperuser', '--noinput'])


def load_sample_data(args):
    print(bold('Loading Lark Camp sample data...'))
    print('You will need to use your superuser credentials')
    print('to complete this task')

    subprocess.run([
        'docker', 'compose', 'run', '--build', '--rm', 'data',
        '/bin/sh', '-c', 'import'])

    hooray('Successfully loaded Lark Camp sample data')


def run_tests(args):
    print(bold('Running backend tests'))

    result = subprocess.run([
        'docker', 'compose', 'exec', 'django', 'python', 'manage.py', 'test'])
    if result.returncode != 0:
        print(bold(red('Backend tests failed!')))
        print(bold(' '.join([
            'Although the process of setting up your development environment',
            'succeeded, please try to find out why these test failures',
            'happened and run the tests again.',
        ])))
    else:
        hooray('Backend tests pass')


def finish(args):
    hooray('Development environment setup finished!')

    print('\n'.join([
        'For more information, see the following resources:',
        '  https://github.com/camphoric/camphoric/blob/main/doc/development.md#frontend-development-process',
        '  https://github.com/camphoric/camphoric/blob/main/doc/development.md#server-development-process',
        '',
        'To see your glorious work in action go to:',
        '  http://localhost:3000',
    ]))


def die(title, *messages):
    print(bold(red(title)))
    for message in messages:
        print(bold(message))
    sys.exit(1)


def hooray(title):
    print(bold(green(f'✅ {title}')))


def bold(text):
    return '\033[1m' + text + '\033[0m'


def green(text):
    return '\033[92m' + text + '\033[0m'


def red(text):
    return '\033[91m' + text + '\033[0m'


if __name__ == '__main__':
    main()
