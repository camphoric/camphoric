export default {
  organization: {
    name: 'SFFMC',
  },
  emailAccount: {
    name: process.env.CAMPHORIC_LTA_GMAIL_NAME,
    host: 'smtp.gmail.com',
    port: '587',
    username: process.env.CAMPHORIC_LTA_GMAIL_USERNAME,
    password: process.env.CAMPHORIC_LTA_GMAIL_PASSWORD,
  },
};
