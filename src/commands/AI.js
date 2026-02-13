const GeminiService = require('../services/GeminiService');
require('dotenv').config();

const gemini = new GeminiService(process.env.GEMINI_API_KEY);

module.exports = {
    name: '!gemini',
    aliases: ['!ai'],
    isPrefix: true,
    async execute(msg) {
        const prompt = msg.body.replace(/^!(gemini|ai) /, '');
        msg.reply('Gemini düşünüyor... 🧠');
        try {
            const response = await gemini.generateResponse(prompt);
            msg.reply(response);
        } catch (error) {
            console.error('Gemini hatası:', error);
            msg.reply('Bir hata oluştu.');
        }
    }
};
