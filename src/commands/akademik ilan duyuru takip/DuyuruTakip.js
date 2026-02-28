const schedule = require('node-schedule');
const AnnouncementService = require('../../services/AnnouncementService');

// =============================================
// 🕐 GÜNLÜK KONTROL SAATİ — Buradan değiştirin!
// Format: 'SS:DD' (örn: '06:40', '09:00', '16:00')
const DAILY_CHECK_TIME = '06:50';
// =============================================

// DAILY_CHECK_TIME'dan cron ifadesini otomatik üret
const [CHECK_HOUR, CHECK_MINUTE] = DAILY_CHECK_TIME.split(':').map(Number);
const CRON_EXPRESSION = `${CHECK_MINUTE} ${CHECK_HOUR} * * *`;

class DuyuruTakip {
    constructor() {
        this.command = '!takip';
        this.description = 'Üniversite ilan/duyuru takip sistemi. Kullanım: !takip başlat / durdur / 3dk aç / 3dk kapat / kontrol / durum / liste';

        this.announcementService = new AnnouncementService();
        this.dailyJob = null;
        this.lastCheckTime = null;
        this.notifyNumber = process.env.WWEBJS_TEST_REMOTE_ID || '905362494516@c.us';
    }

    async init(client) {
        this.client = client;

        const isFirstRun = await this.announcementService.initializeSeen();
        if (isFirstRun) {
            console.log('📡 İlan takip sistemi: İlk tarama tamamlandı, mevcut ilanlar kaydedildi.');
        }

        // Otomatik olarak günlük takibi başlat
        this.startDailySchedule(client);
        console.log(`📡 İlan takip sistemi aktif! (Her gün saat ${DAILY_CHECK_TIME} kontrol)`);
    }

    startDailySchedule(client) {
        if (this.dailyJob) {
            this.dailyJob.cancel();
        }

        // Her gün belirlenen saatte çalışacak (DAILY_CHECK_TIME)
        this.dailyJob = schedule.scheduleJob(CRON_EXPRESSION, async () => {
            console.log(`⏰ Günlük ${DAILY_CHECK_TIME} ilan kontrolü başladı...`);
            await this.runCheck(client);
        });

        console.log(`⏰ Günlük ilan kontrolü zamanlandı: Her gün saat ${DAILY_CHECK_TIME}`);
    }

    async runCheck(client) {
        try {
            this.lastCheckTime = new Date();
            const results = await this.announcementService.checkAllUniversities();

            const hasNew = results.some(r => r.announcements && r.announcements.length > 0);
            const hasError = results.some(r => r.error);

            if (hasNew) {
                const message = this.announcementService.formatNotification(results);
                if (message) {
                    await client.sendMessage(this.notifyNumber, message);
                    console.log('✅ Yeni ilan bildirimi gönderildi.');
                }
            }

            if (hasError) {
                const errorResults = results.filter(r => r.error);
                let errMsg = '⚠️ *İlan Kontrol Hatası*\n\n';
                for (const r of errorResults) {
                    errMsg += `❌ ${r.university.shortName}: ${r.error}\n`;
                }
                await client.sendMessage(this.notifyNumber, errMsg);
            }

            if (!hasNew && !hasError) {
                // Hiçbir yerde ilan yoksa iki ayrı mesajı gönderiyoruz
                let noUniNews = '✅ Okullar için yeni ilan / duyuru eklenmedi.';
                let noSbbNews = '✅ Kariyer Kapısı\'nda (SBB) yeni ilan yüklenmedi.';

                await client.sendMessage(this.notifyNumber, noUniNews);
                await client.sendMessage(this.notifyNumber, noSbbNews);
                console.log('ℹ️ Yeni ilan yok, bildirimler ayrı ayrı gönderildi. Son kontrol:', this.lastCheckTime.toLocaleString('tr-TR'));
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
            if (this.dailyJob) {
                msg.reply(`ℹ️ Günlük takip zaten aktif! Her gün saat ${DAILY_CHECK_TIME}'da kontrol ediliyor.`);
            } else {
                this.startDailySchedule(client);
                msg.reply(`✅ Günlük ilan takibi başlatıldı! Her gün saat ${DAILY_CHECK_TIME}'da kontrol edilecek.`);
            }
        }
        else if (body === '!takip durdur') {
            if (this.dailyJob) {
                this.dailyJob.cancel();
                this.dailyJob = null;
                msg.reply('⏹️ Günlük ilan takibi durduruldu.');
            } else {
                msg.reply('ℹ️ Günlük takip zaten aktif değil.');
            }
        }
        else if (body === '!takip kontrol') {
            msg.reply('🔍 İlanlar kontrol ediliyor...');
            const results = await this.runCheck(client);

            const hasNew = results.some(r => r.announcements && r.announcements.length > 0);
            if (!hasNew) {
                const errorResults = results.filter(r => r.error);
                if (errorResults.length === 0) {
                    msg.reply('ℹ️ Şu an okullarda veya Kariyer Kapısı\'nda yeni ilan/duyuru bulunmuyor.');
                }
            }
        }
        else if (body === '!takip durum') {
            const isDailyActive = this.dailyJob !== null;
            const uniCount = this.announcementService.universities.length;
            const lastCheck = this.lastCheckTime
                ? this.lastCheckTime.toLocaleString('tr-TR')
                : 'Henüz kontrol yapılmadı';

            const nextDailyFire = this.dailyJob && this.dailyJob.nextInvocation()
                ? this.dailyJob.nextInvocation().toLocaleString('tr-TR')
                : 'Belirsiz';

            let statusMsg = '📊 *İlan Takip Durumu*\n\n';
            statusMsg += `• Günlük Durum (${DAILY_CHECK_TIME}): ${isDailyActive ? '✅ Aktif' : '⏹️ Pasif'}\n`;
            statusMsg += `• Takip Edilen: ${uniCount} kurum\n`;
            statusMsg += `• Son Kontrol: ${lastCheck}\n`;
            statusMsg += `• Sonraki Günlük: ${nextDailyFire}\n`;
            statusMsg += `• Bildirim Numarası: ${this.notifyNumber.replace('@c.us', '')}`;

            msg.reply(statusMsg);
        }
        else if (body === '!takip hepsi' || body === '!takip tümilanlar') {
            msg.reply('🔍 Tüm üniversitelerdeki GÜNCEL kayıtlı ilanlar tek tek toplanıyor, bu işlem biraz sürebilir...');

            try {
                let allSitesMsg = '🏫 *Tüm Üniversitelerdeki İlanlar*\n\n';
                let hasAny = false;

                for (const uni of this.announcementService.universities) {
                    try {
                        const anns = await this.announcementService.checkUniversity(uni);
                        if (anns.length > 0) {
                            hasAny = true;
                            allSitesMsg += `📌 *${uni.shortName}* (${anns.length} ilan)\n`;

                            // 5 tanesini gösterelim çok uzun olmaması için
                            const displayAnns = anns.slice(0, 5);
                            for (const ann of displayAnns) {
                                allSitesMsg += `• ${ann.title}\n  🔗 ${ann.url}\n`;
                            }
                            if (anns.length > 5) {
                                allSitesMsg += `... ve ${anns.length - 5} ilan daha.\n`;
                            }
                            allSitesMsg += '\n';
                        }
                    } catch (e) {
                        allSitesMsg += `❌ *${uni.shortName}* taranırken hata oluştu.\n\n`;
                    }
                }

                if (!hasAny) {
                    allSitesMsg = 'ℹ️ Okullarda ve Kariyer Kapısı\'nda listelenecek mevcut ilan bulunamadı.';
                } else if (allSitesMsg.length > 4000) {
                    allSitesMsg = allSitesMsg.substring(0, 4000) + '\n... (Mesaj çok uzun olduğu için kesildi)';
                }

                await msg.reply(allSitesMsg.trim());
            } catch (error) {
                console.error('Tüm ilanları getirme hatası:', error);
                msg.reply('❌ İlanlar toplanırken bir hata oluştu.');
            }
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
                `• \`!takip başlat\` - Günlük (${DAILY_CHECK_TIME}) takibi başlatır\n` +
                '• `!takip durdur` - Günlük takibi durdurur\n' +
                '• `!takip kontrol` - Anlık BİLDİRİM kontrolü yapar\n' +
                '• `!takip hepsi` - Tüm sitelerdeki mevcut ilanları getirir\n' +
                '• `!takip durum` - Takip durumunu gösterir\n' +
                '• `!takip liste` - Üniversite listesini gösterir'
            );
        }
    }
}

module.exports = new DuyuruTakip();
