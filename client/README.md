This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br>
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (Webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

## Backend php script

To get the php side of things working for development, you must have the
following:

- install php via `brew install php`
- link php
    - `sudo mkdir /usr/local/sbin`
    - `sudo chown $USER:admin /usr/local/sbin`
    - `brew link php`
- install composer via `brew install composer`
- run `composer install` in the project root
- create a test sqlite3 db: `sqlite3 ~/larkdb.sq3 < create.sql`
- in addition to running `yarn start`, you'll need to run `yarn php` as well.
  - NOTE: using the this development server will cause all email to be routed
    to `php-test/email/message` instead of actually being sent as long as the
    `USE_SENDMAIL=1` is in the `.env`
- create a `.env` file.  It should look like this:

```
DEBUG=1
USE_SENDMAIL=1
PDO_DSN="sqlite:/path/to/larkdb.sq3"
PDO_USER="username"
PDO_PASS="password"
MAIL_HOST="smtp.gmail.com"
MAIL_FROM_ADDRESS="bob@gmail.com"
MAIL_FROM_NAME="bob shmoe"
MAIL_USER="bob@gmail.com"
MAIL_PASS="bobpass"
MAIL_SEC="tls"
MAIL_PORT="587"
MAIL_TO_ADDRESS="bob@gmail.com"
MAIL_TO_NAME="bob shmoe"
```

