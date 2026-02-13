const fs = require('fs');
const schedule = require('node-schedule');
const path = require('path');

// Global değişkenler ve yardımcı fonksiyonlar
let activeAnnouncements = [];
const DATA_FILE = path.join(__dirname, '../../announcements.json');

const loadAnnouncements = (client) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            activeAnnouncements = JSON.parse(data);

            // Var olan işleri tekrar zamanla
            activeAnnouncements.forEach(job => {
                scheduleAnnouncementJob(job, client);
            });
            console.log(`📡 ${activeAnnouncements.length} adet kayıtlı duyuru yüklendi.`);
        } else {
            fs.writeFileSync(DATA_FILE, '[]');
        }
    } catch (err) {
        console.error('Duyurular yüklenirken hata:', err);
    }
};

const saveAnnouncements = () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(activeAnnouncements, null, 2));
    } catch (err) {
        console.error('Duyurular kaydedilirken hata:', err);
    }
};

const scheduleAnnouncementJob = (job, client) => {
    // Saat ve dakikayı al
    const [hour, minute] = job.time.split(':');

    // Bugünün tarihine saati ayarla
    let scheduleDate = new Date();
    scheduleDate.setHours(hour, minute, 0, 0);

    // Eğer saat çoktan geçtiyse yarına ayarla
    if (scheduleDate < new Date()) {
        scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    // Cron string yerine Date objesi veriyoruz -> Sadece 1 kere çalışır.
    schedule.scheduleJob(job.id, scheduleDate, async function () {
        console.log(`Duyuru gönderimi başladı (Job ID: ${job.id})`);
        await processAnnouncementBatch(job, client);
    });

    console.log(`⏰ Duyuru zamanlandı: ${scheduleDate.toLocaleString()} (ID: ${job.id})`);
};

const processAnnouncementBatch = async (job, client) => {
    let sentCount = 0;
    let failCount = 0;

    // İş zaten bitmiş mi kontrol et
    if (job.nextIndex >= job.numbers.length) {
        finishJob(job);
        return;
    }

    const endIndex = Math.min(job.nextIndex + job.batchSize, job.numbers.length);
    const batch = job.numbers.slice(job.nextIndex, endIndex);

    console.log(`📦 Parça gönderiliyor: ${batch.length} kişi (${job.nextIndex} - ${endIndex})`);

    for (let num of batch) {
        // Numara formatlama
        let formattedNum = num.trim().replace(/\D/g, '');
        if (formattedNum.length === 10) formattedNum = '90' + formattedNum;
        else if (formattedNum.length === 11 && formattedNum.startsWith('0')) formattedNum = '90' + formattedNum.substring(1);

        const finalId = formattedNum.includes('@c.us') ? formattedNum : formattedNum + '@c.us';

        try {
            await client.sendMessage(finalId, job.message);
            sentCount++;
            console.log(`✅ Mesaj gönderildi: ${finalId}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
        } catch (err) {
            console.error(`❌ Mesaj gitmedi (${finalId}):`, err);
            failCount++;
        }
    }

    // İndeksi güncelle
    job.nextIndex = endIndex;

    // Job listesini güncelle (save)
    const jobIndex = activeAnnouncements.findIndex(j => j.id === job.id);
    if (jobIndex !== -1) activeAnnouncements[jobIndex] = job;
    saveAnnouncements();

    // Kontrol: Liste bitti mi?
    if (job.nextIndex >= job.numbers.length) {
        finishJob(job);
    } else {
        // Liste BİTMEDİ. 1 dakika bekle ve devam et.
        console.log(`⏳ Diğer parça için 1 dakika bekleniyor...`);
        setTimeout(() => {
            processAnnouncementBatch(job, client);
        }, 60000);
    }
};

const finishJob = (job) => {
    console.log(`🏁 Duyuru işi TAMAMLANDI (ID: ${job.id}). Listeden siliniyor.`);
    const currentJob = schedule.scheduledJobs[job.id];
    if (currentJob) currentJob.cancel();

    activeAnnouncements = activeAnnouncements.filter(j => j.id !== job.id);
    saveAnnouncements();
};

class Duyuru {
    constructor() {
        this.command = '!duyuru';
        this.description = 'Zamanlanmış ve toplu duyuru gönderme sistemi. Kullanım: !duyuru gönderme_listesi(5xx,5xx) göderilecek_mesaj("mesaj") zaman(HH:mm) adet(N)';
    }

    // Bot açıldığında çalışacak başlangıç fonksiyonu
    init(client) {
        this.client = client;
        loadAnnouncements(client);
    }

    async execute(msg, client) {
        if (!msg.body.startsWith('!duyuru ')) {
            msg.reply('❌ Hatalı kullanım. Örnek: !duyuru gönderme_listesi(05551112233) göderilecek_mesaj("Merhaba") zaman(14:30) adet(10)');
            return;
        }

        try {
            const listMatch = msg.body.match(/gönderme_listesi\s*\(([\d,.\s]+)\)/i);
            const contentMatch = msg.body.match(/göderilecek_mesaj\s*\(['"]?([^)]+)['"]?\)/i);
            const timeMatch = msg.body.match(/zaman\s*\(([\d:]+)\)/i);
            const batchMatch = msg.body.match(/adet\s*\(([\d]+)\)/i);

            if (listMatch && contentMatch) {
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
                    // --- ZAMANLANMIŞ DUYURU ---
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

                    activeAnnouncements.push(newJob);
                    saveAnnouncements();
                    scheduleAnnouncementJob(newJob, client);

                    const chat = await msg.getChat();
                    chat.sendMessage(`✅ *Tek Seferlik Duyuru Zamanlandı!*\n\n🕒 Başlama Saati: ${time}\n📦 Paket Boyutu: ${batchSize}\n👥 Toplam Kişi: ${numbers.length}`);

                } else {
                    // --- ANLIK GÖNDERİM ---
                    const chat = await msg.getChat();
                    await chat.sendMessage(`📢 *Anlık gönderim başlıyor*...\n👥 Hedef: ${numbers.length} kişi.`);

                    let count = 0;
                    for (const finalId of numbers) {
                        try {
                            await client.sendMessage(finalId, messageContent);
                            count++;
                            await new Promise(r => setTimeout(r, 1000));
                        } catch (e) {
                            console.error('Mesaj hatası:', e);
                        }
                    }
                    await chat.sendMessage(`✅ Tamamlandı. ${count}/${numbers.length} mesaj gönderildi.`);
                }
            } else {
                msg.reply('❌ Format Hatalı! Lütfen "gönderme_listesi(...)" ve "göderilecek_mesaj(...)" alanlarını kontrol edin.');
            }
        } catch (e) {
            console.error(e);
            msg.reply('❌ Beklenmedik bir hata oluştu: ' + e.message);
        }
    }
}

module.exports = new Duyuru();
