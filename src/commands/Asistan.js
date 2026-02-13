const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Fallback for missing firebase service
let db, admin;
try {
    const firebaseService = require('../services/firebase');
    db = firebaseService.db;
    admin = firebaseService.admin;
} catch (e) {
    // console.log('Firebase service not found, using local file logging.');
}

module.exports = {
    name: '!asistan',
    aliases: [],
    isPrefix: true,
    cooldowns: new Map(),

    async execute(msg, client) {
        // --- HANDOFF KONTROLÜ (BOT SUSTURULMUŞ MU?) ---
        const chatId = msg.from;
        if (client.handoffStates && client.handoffStates.has(chatId)) {
            const expiration = client.handoffStates.get(chatId);
            if (Date.now() < expiration) {
                console.log(`🤐 Bot suskun modda. (Kalan süre: ${((expiration - Date.now()) / 1000).toFixed(1)}sn)`);
                return; // Bot cevap vermez
            } else {
                client.handoffStates.delete(chatId); // Süre dolmuş, kilidi aç
                console.log(`✅ ${chatId} için suskunluk süresi doldu.`);
            }
        }
        // ----------------------------------------------

        // Mesajdan komutu çıkartıp sadece soruyu alalım
        let query = msg.body;
        if (query.startsWith('!asistan ')) {
            query = query.slice(9).trim();
        } else if (query === '!asistan') {
            query = '';
        }

        if (!query) {
            await msg.reply('Lütfen bir soru sorun. Örnek: !asistan Merhaba');
            return;
        }

        // --- HIZ SINIRI KONTROLÜ (RATE LIMITING) ---
        const userId = msg.from;
        const now = Date.now();
        const cooldownTime = 5000; // 5 Saniye

        if (this.cooldowns.has(userId)) {
            const expirationTime = this.cooldowns.get(userId) + cooldownTime;
            if (now < expirationTime) {
                const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                await msg.reply(`⚠️ Çok hızlı işlem yapıyorsunuz. Lütfen ${timeLeft} saniye bekleyip tekrar deneyin.`);
                return;
            }
        }
        // Zaman damgasını güncelle
        this.cooldowns.set(userId, now);
        // ------------------------------------------

        const apiUrl = 'https://agentic-rag-service-700341739468.us-central1.run.app/ask';

        try {
            const chat = await msg.getChat();
            await chat.sendStateTyping();

            // Client property injection for bot locking (if widely used, otherwise just local var)
            client.isBotSending = true;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: query })
            });

            if (!response.ok) {
                throw new Error(`API Hatası: ${response.statusText}`);
            }

            const data = await response.json();
            // console.log('🤖 API Response:', data);

            const isFailure = data.success === false ||
                (data.answer && data.answer.includes("I could not find an answer"));

            if (!isFailure) {
                await msg.reply(data.answer);
            } else {
                // Fallback logging
                if (db && admin) {
                    try {
                        const cleanNumber = msg.from.replace('@c.us', '');
                        const logEntry = {
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            phoneNumber: cleanNumber,
                            userMessage: query,
                            botMessage: data.message || "Cevap bulunamadı (Otomatik Kayıt)"
                        };
                        await db.collection('unanswered_logs').add(logEntry);
                        console.log('✅ Cevap bulunamadı, Firebase\'e kaydedildi.');
                    } catch (dbError) {
                        console.error('❌ Firebase kayıt hatası:', dbError);
                        this.logToFile(msg.from, query, data.message);
                    }
                } else {
                    this.logToFile(msg.from, query, data.message);
                }

                await msg.reply("Sorunuzla ilgili şu an net bir bilgi veremiyorum. Sorunuz yetkililere iletildi, en kısa sürede dönüş yapılacaktır.");
            }

        } catch (error) {
            console.error('Asistan Hatası:', error);
            await msg.reply('Üzgünüm, şu an asistana ulaşamıyorum. Lütfen daha sonra tekrar deneyin.');
        } finally {
            client.isBotSending = false;
        }
    },

    logToFile(user, question, apiMessage) {
        try {
            const logFilePath = path.join(__dirname, '../../unanswered_questions.json');
            let logs = [];
            if (fs.existsSync(logFilePath)) {
                logs = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
            }
            logs.push({
                timestamp: new Date().toISOString(),
                user: user,
                question: question,
                api_message: apiMessage || "Cevap bulunamadı"
            });
            fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
        } catch (fileErr) {
            console.error('Dosya yazma hatası:', fileErr);
        }
    }
};
