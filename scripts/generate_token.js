require('dotenv').config();
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 'test-user', role: 'OWNER', shopId: 'test-shop' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
console.log(token);
