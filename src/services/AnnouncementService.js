const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_FILE = path.join(__dirname, '../../seen_announcements.json');

// Bazı üniversite siteleri geçersiz SSL sertifikası kullanabildiği için doğrulama hatasını yok sayalım:
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

class AnnouncementService {
    constructor() {
        this.universities = [
            {
                name: 'SUBÜ (Sakarya Uygulamalı Bilimler Üniversitesi)',
                shortName: 'SUBÜ',
                url: 'https://ilan.subu.edu.tr/',
                sections: ['Sonuçlar', 'Öğretim Üyesi', 'İdari Personel']
            },
            {
                name: 'İstanbul Teknik Üniversitesi',
                shortName: 'İTÜ',
                url: 'https://pdb.itu.edu.tr/',
                sections: ['Personel Daire Başkanlığı']
            },
            {
                name: 'Ege Üniversitesi (İzmir)',
                shortName: 'Ege Üni',
                url: 'https://personeldb.ege.edu.tr/tr-1616/duyurular.html',
                sections: ['Akademik Kadro', 'Atama']
            },
            {
                name: 'Düzce Üniversitesi',
                shortName: 'Düzce Üni',
                url: 'https://personel.duzce.edu.tr/Duyurular',
                sections: ['Personel İlanları']
            },
            {
                name: 'Bursa Uludağ Üniversitesi',
                shortName: 'Bursa Üni',
                url: 'https://uludag.edu.tr/personel',
                sections: ['Sözleşmeli', 'Akademik İlan']
            },
            {
                name: 'Çukurova Üniversitesi',
                shortName: 'Çukurova Üni',
                url: 'https://personel.cu.edu.tr/',
                sections: ['İlanlar']
            },
            {
                name: 'SBB Kamu İlanları (Kariyer Kapısı)',
                shortName: 'SBB (Kamu)',
                url: 'https://kamuilan.sbb.gov.tr/',
                sections: ['SSB', 'Memur', 'Sözleşmeli', 'Akademik']
            }
        ];
        this.seenAnnouncements = this.loadSeen();
    }

    loadSeen() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            }
        } catch (err) {
            console.error('Görülen ilanlar yüklenirken hata:', err);
        }
        return {};
    }

    saveSeen() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.seenAnnouncements, null, 2), 'utf8');
        } catch (err) {
            console.error('Görülen ilanlar kaydedilirken hata:', err);
        }
    }

    async fetchPage(url) {
        const response = await fetch(url, {
            agent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'tr-TR,tr;q=0.9'
            },
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    }

    parseSUBU(html) {
        const $ = cheerio.load(html);
        const announcements = [];

        $('h2').each((_, headerEl) => {
            const sectionTitle = $(headerEl).text().trim();
            const relevantSections = ['Sonuçlar', 'Öğretim Üyesi İlanları', 'Öğretim Elemanı İlanları', 'İdari Personel İlanları', 'Görevde Yükselme ve Ünvan Değişikliği Sınavı', 'Duyurular'];

            if (!relevantSections.some(s => sectionTitle.includes(s))) return;

            let container = $(headerEl).closest('.block, .region, section, .panel-pane').find('.view-content, .item-list');
            let links = container.length ? container.find('a') : $(headerEl).parent().find('a').filter((_, el) => $(el).attr('href') && $(el).attr('href').includes('/tr/node/'));

            if (!links || links.length === 0) {
                const block = $(headerEl).closest('.block');
                if (block.length) {
                    links = block.find('a').filter((_, el) => $(el).attr('href') && ($(el).attr('href').includes('/tr/node/') || $(el).attr('href').includes('/tr/')));
                }
            }

            if (links && links.length) {
                links.each((_, linkEl) => {
                    const title = $(linkEl).text().trim().replace(/\s+/g, ' ');
                    let href = $(linkEl).attr('href');

                    if (!title || title === 'Hepsi' || !href || href === '/' || href === '#' || href === 'https://ilan.subu.edu.tr/') return;
                    if (href.startsWith('/')) href = 'https://ilan.subu.edu.tr' + href;

                    if (!announcements.some(a => a.url === href)) {
                        announcements.push({ section: sectionTitle, title: title, url: href });
                    }
                });
            }
        });

        if (announcements.length === 0) {
            return this.parseGeneric(html, { url: 'https://ilan.subu.edu.tr/' });
        }

        return announcements;
    }

    parseGeneric(html, uni) {
        const $ = cheerio.load(html);
        const announcements = [];
        let baseUrl = new URL(uni.url).origin;

        $('a').each((_, el) => {
            const text = $(el).text().trim().replace(/\s+/g, ' ');
            const lowerText = text.toLowerCase();
            let href = $(el).attr('href');

            if (!href || href === '#' || href === '/' || href.startsWith('javascript:')) return;

            // Sadece personel alımı ve akademik kadro ilanları ile ilgili kesin kelimeler
            const keywords = ['öğretim elemanı', 'öğretim üyesi', 'akademik', 'personel', 'sözleşmeli', 'araştırma görevlisi', 'doçent', 'profesör', 'öğretim görevlisi', 'kadro ilanı', 'ilanı', 'ilanları', 'alım', 'atama', 'sonuç', 'yerleştirme', 'sürekli işçi'];

            // Kesinlikle dahil edilmemesi gereken, kurum hakkındaki sistem sayfaları
            const excludeWords = ['yönetmelik', 'yönerge', 'mevzuat', 'rehber', 'form', 'dilekçe', 'iletişim', 'telefon', 'adres', 'ebys', 'e-posta', 'harita', 'kurumsal', 'misyon', 'vizyon', 'tarihçe', 'öğrenci', 'yemek', 'burs', 'sempozyum', 'tören', 'kongre', 'konferans', 'şenlik', 'festival', 'spor', 'mezuniyet', 'ders', 'sınav takvimi', 'akademik takvim', 'yatay geçiş', 'yüksek lisans', 'doktora', 'uzaktan eğitim', 'anasayfa', 'ana sayfa', 'hakkımızda', 'personel listesi', 'devamını oku', 'tüm duyurular', 'organizasyon', 'faaliyet raporu', 'hizmet', 'iş akış', 'şeması', 'teşkilat', 'kalite', 'politikaları', 'başkanı'];

            if (keywords.some(k => lowerText.includes(k)) && !excludeWords.some(k => lowerText.includes(k))) {
                let fullUrl = href;
                if (href.startsWith('/')) {
                    fullUrl = baseUrl + href;
                } else if (!href.startsWith('http')) {
                    try { fullUrl = new URL(href, uni.url).href; } catch (e) { fullUrl = uni.url.endsWith('/') ? uni.url + href : uni.url + '/' + href; }
                }

                if (!announcements.some(a => a.url === fullUrl)) {
                    announcements.push({
                        section: 'Personel İlanları / Duyurular',
                        title: text,
                        url: fullUrl
                    });
                }
            }
        });

        return announcements;
    }

    async checkUniversity(uni) {
        const html = await this.fetchPage(uni.url);
        if (uni.shortName === 'SUBÜ') {
            return this.parseSUBU(html);
        } else if (uni.shortName === 'SBB (Kamu)') {
            return await this.parseSBB(uni);
        } else {
            return this.parseGeneric(html, uni);
        }
    }

    async parseSBB(uni) {
        // SBB için kendi içindeki tüm ilan detay sayfalarını tek tek gezip Bilgisayar Mühendisi arayacağız.
        const html = await this.fetchPage(uni.url);
        const $ = cheerio.load(html);
        const announcements = [];
        const sbbLinks = [];

        $('a').each((_, el) => {
            const href = $(el).attr('href');
            let text = $(el).text().trim().replace(/\\s+/g, ' ');

            if (href && href.includes('ilanDetay.aspx')) {
                let fullUrl = href.startsWith('http') ? href : 'https://kamuilan.sbb.gov.tr/' + href;
                if (!sbbLinks.some(l => l.url === fullUrl)) {
                    sbbLinks.push({ title: text, url: fullUrl });
                }
            }
        });

        // Tüm SBB linklerine tek tek girip metni kontrol edelim:
        for (const link of sbbLinks) {
            // Check if we already saw this SBB link
            if (this.seenAnnouncements.some(seen => seen.url === link.url)) {
                continue; // Zaten görülmüş ilansa içine girmeyelim boşuna (performans)
            }

            try {
                const detailHtml = await this.fetchPage(link.url);
                const detail$ = cheerio.load(detailHtml);
                const bodyText = detail$('body').text().toLowerCase();

                // Kariyer Kapısı alternatifinde "Bilgisayar Mühendisi" arama filtresi:
                if (bodyText.includes('bilgisayar mühendis') || bodyText.includes('bilişim personel')) {
                    announcements.push({
                        section: '💻 Bilgisayar Mühendisi / Bilişim Personeli İlanı',
                        title: link.title,
                        url: link.url
                    });
                } else {
                    // İlgimizi çekmeyen ilanı da bir daha taramamak için hayalet olarak ekleyelim ama listeye koymayalım
                    // Save as seen but return empty array so bot doesn't send message for non-CE jobs.
                    this.saveSeen([{ url: link.url, title: link.title, date: new Date().toISOString() }]);
                }
            } catch (err) {
                console.error(`SBB detay çekilemedi (${link.url}):`, err.message);
            }
        }

        return announcements;
    }

    async getNewAnnouncements(uni) {
        const key = uni.shortName || uni.name;
        const allAnnouncements = await this.checkUniversity(uni);

        if (!this.seenAnnouncements[key]) {
            this.seenAnnouncements[key] = [];
        }

        const seenUrls = new Set(this.seenAnnouncements[key]);
        const newOnes = allAnnouncements.filter(a => !seenUrls.has(a.url));

        const allUrls = allAnnouncements.map(a => a.url);
        this.seenAnnouncements[key] = allUrls;
        this.saveSeen();

        return newOnes;
    }

    async checkAllUniversities() {
        const results = [];
        for (const uni of this.universities) {
            try {
                const newAnnouncements = await this.getNewAnnouncements(uni);
                if (newAnnouncements.length > 0) {
                    results.push({
                        university: uni,
                        announcements: newAnnouncements
                    });
                }
            } catch (error) {
                console.error(`${uni.shortName} kontrol hatası:`, error.message);
                results.push({
                    university: uni,
                    error: error.message
                });
            }
        }
        return results;
    }

    formatNotification(results) {
        if (results.length === 0) return null;

        let message = '🔔 *Yeni Üniversite İlanları/Duyuruları*\n\n';

        for (const result of results) {
            if (result.error) {
                message += `❌ *${result.university.shortName}*: Hata - ${result.error}\n\n`;
                continue;
            }

            message += `🏫 *${result.university.shortName}*\n`;

            const bySection = {};
            for (const ann of result.announcements) {
                if (!bySection[ann.section]) bySection[ann.section] = [];
                bySection[ann.section].push(ann);
            }

            for (const [section, anns] of Object.entries(bySection)) {
                message += `\n📋 _${section}_\n`;
                for (const ann of anns) {
                    message += `• ${ann.title}\n  🔗 ${ann.url}\n`;
                }
            }
            message += '\n';
        }

        return message.trim();
    }

    async initializeSeen() {
        let initialized = false;
        for (const uni of this.universities) {
            const key = uni.shortName || uni.name;
            if (!this.seenAnnouncements[key] || this.seenAnnouncements[key].length === 0) {
                try {
                    const allAnnouncements = await this.checkUniversity(uni);
                    this.seenAnnouncements[key] = allAnnouncements.map(a => a.url);
                    this.saveSeen();
                    console.log(`📡 ${uni.shortName}: ${allAnnouncements.length} mevcut ilan kaydedildi.`);
                    initialized = true;
                } catch (error) {
                    console.error(`${uni.shortName} başlangıç taraması hatası:`, error.message);
                }
            }
        }
        return initialized;
    }
}

module.exports = AnnouncementService;
