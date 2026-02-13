const fetch = require('node-fetch');

module.exports = {
    name: '!external-api',
    aliases: ['!butik', '!sados', '!rodos'],
    isPrefix: true,

    async execute(msg) {
        const body = msg.body;

        if (body.startsWith('!butik ')) {
            await this.handleButik(msg);
        } else if (body.startsWith('!sados ')) {
            await this.handleSados(msg);
        } else if (body.startsWith('!rodos ')) {
            await this.handleRodos(msg);
        }
    },

    async handleButik(msg) {
        const question = msg.body.slice(7).trim();
        if (!question) {
            msg.reply('Lütfen bir soru sorun. Örnek: !butik Kot pantolonların fiyatı nedir?');
            return;
        }

        try {
            const response = await fetch('http://fatih066.pythonanywhere.com/butik', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) throw new Error(`API hatası: ${response.statusText}`);
            const data = await response.json();
            msg.reply(data.answer ? data.answer : 'Bir cevap alınamadı.');
        } catch (error) {
            console.error('Butik API hatası:', error);
            msg.reply('Üzgünüm, butik servisine ulaşırken bir hata oluştu.');
        }
    },

    async handleSados(msg) {
        const question = msg.body.slice(7).trim();
        if (!question) {
            msg.reply('Lütfen bir soru sorun. Örnek: !sados Dosyalarda ne anlatılıyor?');
            return;
        }

        try {
            const response = await fetch('http://fatih066.pythonanywhere.com/sados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) throw new Error(`API hatası: ${response.statusText}`);
            const data = await response.json();
            msg.reply(data.answer ? data.answer : 'Bir cevap alınamadı.');
        } catch (error) {
            console.error('Sados API hatası:', error);
            msg.reply('Üzgünüm, sados servisine ulaşırken bir hata oluştu.');
        }
    },

    async handleRodos(msg) {
        const question = msg.body.slice(7).trim();
        if (!question) {
            msg.reply('Lütfen bir soru sorun. Örnek: !rodos Veritabanındaki belgelerde neler anlatılıyor?');
            return;
        }

        try {
            const response = await fetch('https://fatih066.pythonanywhere.com/pdf/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) throw new Error(`API hatası: ${response.statusText}`);
            const data = await response.json();

            if (data.answer) {
                let replyMsg = data.answer;
                if (data.sources && data.sources.length > 0) {
                    replyMsg += '\n\nKaynaklar:\n' + data.sources.join('\n');
                }
                msg.reply(replyMsg);
            } else {
                msg.reply('Bir cevap alınamadı.');
            }
        } catch (error) {
            console.error('Rodos API hatası:', error);
            msg.reply('Üzgünüm, Rodos servisine ulaşırken bir hata oluştu.');
        }
    }
};
