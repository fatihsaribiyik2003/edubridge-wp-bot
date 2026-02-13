module.exports = {
    name: '!toplumesaj',
    isPrefix: true,

    async execute(msg, client) {
        try {
            const match = msg.body.match(/!toplumesaj\s*\(([^)]+)\)\s*(.+)/s);

            if (match) {
                const numbersStr = match[1];
                const message = match[2];
                const numbers = numbersStr.split(',').map(n => n.trim().replace(/\D/g, '')).filter(n => n.length > 0);

                if (numbers.length === 0) {
                    msg.reply('❌ Hiçbir geçerli numara bulunamadı.');
                    return;
                }

                msg.reply(`📢 ${numbers.length} kişiye mesaj gönderimi başlıyor...`);

                let success = 0;
                let fail = 0;

                for (let num of numbers) {
                    if (num.length === 10) num = '90' + num;
                    else if (num.length === 11 && num.startsWith('0')) num = '90' + num.substring(1);

                    const chatId = num.includes('@c.us') ? num : num + '@c.us';

                    try {
                        await client.sendMessage(chatId, message);
                        success++;
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (err) {
                        console.error(`Gönderim hatası (${num}):`, err.message);
                        fail++;
                    }
                }

                msg.reply(`✅ Gönderim tamamlandı.\nBaşarılı: ${success}\nBaşarısız: ${fail}`);

            } else {
                msg.reply('❌ Hatalı format!\nDoğru kullanım: `!toplumesaj (5551234567, 5559876543) Mesajınız buraya`');
            }
        } catch (e) {
            console.error('Toplu mesaj hatası:', e);
            msg.reply('❌ Bir hata oluştu.');
        }
    }
};
