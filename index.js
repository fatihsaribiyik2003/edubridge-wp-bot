require('dotenv').config();
const Bot = require('./src/structures/Bot');

const bot = new Bot();
bot.initialize();
