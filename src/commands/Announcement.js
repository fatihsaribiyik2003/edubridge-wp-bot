module.exports = {
    name: '!duyuru',
    isPrefix: true,

    async execute(msg, client, announcementManager) {
        try {
            // Regex to parse arguments
            const listMatch = msg.body.match(/gönderme_listesi\s*\(([\d,.\s]+)\)/i);
            const contentMatch = msg.body.match(/göderilecek_mesaj\s*\(['"]?([^)]+)['"]?\)/i);
            const timeMatch = msg.body.match(/zaman\s*\(([\d:]+)\)/i);
            const batchMatch = msg.body.match(/adet\s*\(([\d]+)\)/i);

            if (listMatch && contentMatch) {
                // Parse numbers
                let rawNumbers = listMatch[1].replace(/\./g, ',').split(',');
                let messageContent = contentMatch[1];
                let numbers = [];

                for (let num of rawNumbers) {
                    num = num.trim().replace(/\D/g, '');
                    if (num.length > 0) {
                        let formattedNum = num;
                        if (num.length === 10) formattedNum = '90' + num;
                        else if (num.length === 11 && formattedNum.startsWith('0')) formattedNum = '90' + formattedNum.substring(1);

                        numbers.push(formattedNum.includes('@c.us') ? formattedNum : formattedNum + '@c.us');
                    }
                }

                if (timeMatch) {
                    // --- Scheduled Mode ---
                    const time = timeMatch[1];
                    const batchSize = batchMatch ? parseInt(batchMatch[1]) : numbers.length;

                    const newJob = {
                        id: `job_${Date.now()}`,
                        numbers: numbers,
                        message: messageContent,
                        time: time,
                        batchSize: batchSize,
                        nextIndex: 0
                    };

                    announcementManager.addAnnouncement(newJob);

                    const chat = await msg.getChat();
                    chat.sendMessage(`✅ Zamanlanmış Duyuru Oluşturuldu!\n\n🕒 Zaman: Her gün ${time}\n📦 Paket Boyutu: ${batchSize} kişi\n👥 Toplam Kişi: ${numbers.length}\n🆔 Job ID: ${newJob.id}`);

                } else {
                    // --- Instant Mode ---
                    let successCount = 0;
                    let failCount = 0;

                    const chat = await msg.getChat();
                    await chat.sendMessage(`📢 Anlık duyuru işlemi başlatıldı. ${numbers.length} kişiye gönderilecek...`);

                    for (const finalId of numbers) {
                        try {
                            await client.sendMessage(finalId, messageContent);
                            successCount++;
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (err) {
                            console.error(`Mesaj gönderilemedi (${finalId}):`, err);
                            failCount++;
                        }
                    }
                    await chat.sendMessage(`✅ Duyuru tamamlandı.\nBaşarılı: ${successCount}\nBaşarısız: ${failCount}`);
                }

            } else {
                const chat = await msg.getChat();
                chat.sendMessage('❌ Hatalı format!\nDoğru kullanım:\n!duyuru gönderme_listesi(...) göderilecek_mesaj(...) [zaman(HH:mm) adet(N)]');
            }
        } catch (e) {
            console.error('Duyuru hatası:', e);
            const chat = await msg.getChat();
            chat.sendMessage('❌ Bir hata oluştu: ' + e.message);
        }
    }
};
