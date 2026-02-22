const schedule = require('node-schedule');
const AnnouncementService = require('../../services/AnnouncementService');

class DuyuruTakip {
    constructor() {
        this.command = '!takip';
        this.description = 'Üniversite ilan/duyuru takip sistemi. Kullanım: !takip başlat / durdur / kontrol / durum / liste';

        // Sınıf seviyesine (this context'ine) taşındı
        this.announcementService = new AnnouncementService();
        this.scheduledJob = null;
        this.lastCheckTime = null;
        this.notifyNumber = process.env.WWEBJS_TEST_REMOTE_ID || '905387994516@c.us';
    }

    // Bot açıldığında otomatik çalışır
    async init(client) {
        this.client = client;

        // İlk çalıştırmada mevcut ilanları "görülmüş" olarak kaydet
        const isFirstRun = await this.announcementService.initializeSeen();
        if (isFirstRun) {
            console.log('📡 İlan takip sistemi: İlk tarama tamamlandı, mevcut ilanlar kaydedildi.');
        }

        // Otomatik olarak günlük takibi başlat (her gün saat 16:00)
        this.startSchedule(client);
        console.log('📡 İlan takip sistemi aktif! (Her gün saat 16:00 kontrol)');
    }

    startSchedule(client) {
        // Önceki job varsa iptal et
        if (this.scheduledJob) {
            this.scheduledJob.cancel();
        }

        // Her gün saat 16:00'da çalışacak (cron: dakika saat gün ay haftanıngünü)
        this.scheduledJob = schedule.scheduleJob('0 16 * * *', async () => {
            console.log('⏰ Zamanlanmış ilan kontrolü başladı...');
            await this.runCheck(client);
        });

        console.log('⏰ Günlük ilan kontrolü zamanlandı: Her gün saat 16:00');
    }

    async runCheck(client) {
        try {
            this.lastCheckTime = new Date();
            const results = await this.announcementService.checkAllUniversities();

            // Sadece yeni ilan varsa bildirim gönder
            const hasNew = results.some(r => r.announcements && r.announcements.length > 0);
            const hasError = results.some(r => r.error);

            if (hasNew) {
                const message = this.announcementService.formatNotification(results);
                if (message) {
                    await client.sendMessage(this.notifyNumber, message);
                    console.log('✅ Yeni ilan bildirimi gönderildi.');
                }
            } else if (hasError) {
                const errorResults = results.filter(r => r.error);
                let errMsg = '⚠️ *İlan Kontrol Hatası*\n\n';
                for (const r of errorResults) {
                    errMsg += `❌ ${r.university.shortName}: ${r.error}\n`;
                }
                await client.sendMessage(this.notifyNumber, errMsg);
            } else {
                // Yeni ilan yok — yine de bildirim gönder
                let noNewsMsg = '✅ *Duyurular kontrol edildi, yeni ilan yok.*\n\n';
                for (const uni of this.announcementService.universities) {
                    noNewsMsg += `🔗 ${uni.url}\n`;
                }
                await client.sendMessage(this.notifyNumber, noNewsMsg.trim());
                console.log('ℹ️ Yeni ilan yok, bildirim gönderildi. Son kontrol:', this.lastCheckTime.toLocaleString('tr-TR'));
            }

            return results;
        } catch (error) {
            console.error('İlan kontrol hatası:', error);
            return [];
        }
    }

    async execute(msg, client) {
        const body = msg.body.trim().toLowerCase();

        if (body === '!takip başlat' || body === '!takip baslat') {
            if (this.scheduledJob) {
                msg.reply('ℹ️ Takip zaten aktif! Her gün saat 16:00\'da kontrol ediliyor.');
            } else {
                this.startSchedule(client);
                msg.reply('✅ İlan takibi başlatıldı! Her gün saat 16:00\'da kontrol edilecek.');
            }
        }
        else if (body === '!takip durdur') {
            if (this.scheduledJob) {
                this.scheduledJob.cancel();
                this.scheduledJob = null;
                msg.reply('⏹️ İlan takibi durduruldu.');
            } else {
                msg.reply('ℹ️ Takip zaten aktif değil.');
            }
        }
        else if (body === '!takip kontrol') {
            msg.reply('🔍 İlanlar kontrol ediliyor...');
            const results = await this.runCheck(client);

            const hasNew = results.some(r => r.announcements && r.announcements.length > 0);
            if (!hasNew) {
                const errorResults = results.filter(r => r.error);
                if (errorResults.length === 0) {
                    msg.reply('ℹ️ Şu an yeni ilan/duyuru bulunmuyor.');
                }
            }
        }
        else if (body === '!takip durum') {
            const isActive = this.scheduledJob !== null;
            const uniCount = this.announcementService.universities.length;
            const lastCheck = this.lastCheckTime
                ? this.lastCheckTime.toLocaleString('tr-TR')
                : 'Henüz kontrol yapılmadı';

            const nextFire = this.scheduledJob && this.scheduledJob.nextInvocation()
                ? this.scheduledJob.nextInvocation().toLocaleString('tr-TR')
                : 'Belirsiz';

            let statusMsg = '📊 *İlan Takip Durumu*\n\n';
            statusMsg += `• Durum: ${isActive ? '✅ Aktif' : '⏹️ Pasif'}\n`;
            statusMsg += `• Kontrol Saati: Her gün 16:00\n`;
            statusMsg += `• Takip Edilen: ${uniCount} üniversite\n`;
            statusMsg += `• Son Kontrol: ${lastCheck}\n`;
            statusMsg += `• Sonraki Kontrol: ${nextFire}\n`;
            statusMsg += `• Bildirim Numarası: ${this.notifyNumber.replace('@c.us', '')}`;

            msg.reply(statusMsg);
        }
        else if (body.startsWith('!takip ilanlar')) {
            const parts = body.split(' ');
            const targetUni = parts.slice(2).join(' ').trim();

            if (!targetUni) {
                let msgText = 'ℹ️ Lütfen ilanlarını görmek istediğiniz üniversiteyi yazın.\n*Örnek:* !takip ilanlar itü\n\n*Takip Edilen Üniversiteler:*\n';
                this.announcementService.universities.forEach(u => msgText += `• ${u.shortName.toLowerCase()}\n`);
                return msg.reply(msgText);
            }

            const uni = this.announcementService.universities.find(u => u.shortName.toLowerCase() === targetUni.toLowerCase());

            if (!uni) {
                return msg.reply('❌ Belirtilen üniversite bulunamadı. Liste için: `!takip liste`');
            }

            msg.reply(`📋 ${uni.shortName} ilanları getiriliyor...`);
            try {
                const allAnnouncements = await this.announcementService.checkUniversity(uni);

                if (allAnnouncements.length === 0) {
                    return msg.reply(`ℹ️ ${uni.shortName}: Hiç ilan/duyuru bulunamadı.`);
                }

                const bySection = {};
                for (const ann of allAnnouncements) {
                    if (!bySection[ann.section]) bySection[ann.section] = [];
                    bySection[ann.section].push(ann);
                }

                let listMsg = `🏫 *${uni.shortName} — Tüm İlanlar* (${allAnnouncements.length} adet)\n\n`;

                for (const [section, anns] of Object.entries(bySection)) {
                    listMsg += `📋 _${section}_\n`;
                    for (const ann of anns) {
                        listMsg += `• ${ann.title}\n  🔗 ${ann.url}\n`;
                    }
                    listMsg += '\n';
                }

                if (listMsg.length > 4000) {
                    listMsg = listMsg.substring(0, 4000) + '\n\n... (Daha fazla ilan var, liste kesildi)';
                }

                await msg.reply(listMsg.trim());
            } catch (error) {
                console.error('İlan listesi hatası:', error);
                msg.reply('❌ İlanlar getirilirken hata oluştu: ' + error.message);
            }
        }
        else if (body === '!takip liste') {
            let listMsg = '🏫 *Takip Edilen Üniversiteler*\n\n';
            for (const uni of this.announcementService.universities) {
                listMsg += `📌 *${uni.name}*\n`;
                listMsg += `   🔗 ${uni.url}\n`;
                listMsg += `   📋 Bölümler: ${uni.sections.join(', ')}\n\n`;
            }
            msg.reply(listMsg);
        }
        else {
            msg.reply(
                '❌ Geçersiz komut.\n\n' +
                '*Kullanım:*\n' +
                '• `!takip başlat` - Günlük takibi başlatır\n' +
                '• `!takip durdur` - Takibi durdurur\n' +
                '• `!takip kontrol` - Anlık kontrol yapar\n' +
                '• `!takip durum` - Takip durumunu gösterir\n' +
                '• `!takip liste` - Üniversite listesini gösterir'
            );
        }
    }
}

module.exports = new DuyuruTakip();
