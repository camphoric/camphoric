export default {
  organization: {
    name: 'Lark Traditional Arts',
  },
  emailAccount: {
    name: 'Test gmail account',
    host: 'smtp.gmail.com',
    port: '587',
    username: process.env.CAMPHORIC_LTA_GMAIL_USERNAME,
    password: process.env.CAMPHORIC_LTA_GMAIL_PASSWORD,
  },
};
