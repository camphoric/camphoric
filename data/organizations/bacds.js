export default {
  organization: {
    name: 'BACDS',
  },
  emailAccount: process.env.CAMPHORIC_TEST_GMAIL_USERNAME ? {
    name: 'Test gmail account',
    host: 'smtp.gmail.com',
    port: '587',
    username: process.env.CAMPHORIC_TEST_GMAIL_USERNAME,
    password: process.env.CAMPHORIC_TEST_GMAIL_PASSWORD,
  } : {
    name: 'Dummy email account',
    backend: 'django.core.mail.backends.console.EmailBackend',
    host: 'smtp.example.com',
    port: '587',
  },
};
