const crypto = require('crypto');
require('dotenv').config();

const key = process.env.SEC_KEY;

const secret = process.env.SEC_KEY_SES;

const hash = crypto.createHmac('SHA512', 'key')
                    .update('secret')
                    .digest('hex')
                    .toString('base64');
console.log(hash);