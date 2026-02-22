const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../seen_announcements.json');

class AnnouncementService {
    constructor() {
        this.universities = [
            {
                name: 'SUBÜ (Sakarya Uygulamalı Bilimler Üniversitesi)',
                shortName: 'SUBÜ',
                url: 'https://ilan.subu.edu.tr/',
                sections: [
                    'Sonuçlar',
                    'Öğretim Üyesi İlanları',
                    'Öğretim Elemanı İlanları',
                    'İdari Personel İlanları',
                    'Görevde Yükselme ve Ünvan Değişikliği Sınavı',
                    'Duyurular'
                ]
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
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

        // SUBU page uses h2 headers for sections followed by links
        // Each section has a view-content div with links
        $('h2').each((_, headerEl) => {
            const sectionTitle = $(headerEl).text().trim();

            // Skip irrelevant headers
            const relevantSections = [
                'Sonuçlar',
                'Öğretim Üyesi İlanları',
                'Öğretim Elemanı İlanları',
                'İdari Personel İlanları',
                'Görevde Yükselme ve Ünvan Değişikliği Sınavı',
                'Duyurular'
            ];

            if (!relevantSections.some(s => sectionTitle.includes(s))) return;

            // Get the container after the h2 (Drupal views typically use .view-content)
            const container = $(headerEl).closest('.block, .region, section, .panel-pane')
                .find('.view-content, .item-list');

            // Also try siblings
            let links;
            if (container.length) {
                links = container.find('a');
            } else {
                // Fallback: get the next sibling elements until next h2
                const parent = $(headerEl).parent();
                links = parent.find('a').filter((_, el) => {
                    const href = $(el).attr('href');
                    return href && href.includes('/tr/node/');
                });
            }

            // If still no luck, search in the same parent block
            if (!links || links.length === 0) {
                const block = $(headerEl).closest('.block');
                if (block.length) {
                    links = block.find('a').filter((_, el) => {
                        const href = $(el).attr('href');
                        return href && (href.includes('/tr/node/') || href.includes('/tr/'));
                    });
                }
            }

            if (links && links.length) {
                links.each((_, linkEl) => {
                    const title = $(linkEl).text().trim();
                    let href = $(linkEl).attr('href');

                    // Skip "Hepsi" links and empty titles
                    if (!title || title === 'Hepsi' || !href) return;
                    // Skip non-content links
                    if (href === '/' || href === '#' || href === 'https://ilan.subu.edu.tr/') return;

                    // Make absolute URL
                    if (href.startsWith('/')) {
                        href = 'https://ilan.subu.edu.tr' + href;
                    }

                    // Avoid duplicates within same parse
                    if (!announcements.some(a => a.url === href)) {
                        announcements.push({
                            section: sectionTitle,
                            title: title,
                            url: href
                        });
                    }
                });
            }
        });

        // Fallback: if h2-based parsing found nothing, try link-based approach
        if (announcements.length === 0) {
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();

                if (href && href.includes('/tr/node/') && title && title.length > 10) {
                    const fullUrl = href.startsWith('/') ? 'https://ilan.subu.edu.tr' + href : href;
                    if (!announcements.some(a => a.url === fullUrl)) {
                        announcements.push({
                            section: 'Genel',
                            title: title,
                            url: fullUrl
                        });
                    }
                }
            });
        }

        return announcements;
    }

    async checkUniversity(uni) {
        const html = await this.fetchPage(uni.url);
        return this.parseSUBU(html);
    }

    async getNewAnnouncements(uni) {
        const key = uni.shortName || uni.name;
        const allAnnouncements = await this.checkUniversity(uni);

        if (!this.seenAnnouncements[key]) {
            this.seenAnnouncements[key] = [];
        }

        const seenUrls = new Set(this.seenAnnouncements[key]);
        const newOnes = allAnnouncements.filter(a => !seenUrls.has(a.url));

        // Mark all current announcements as seen
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

            // Group by section
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

    // İlk çalıştırmada mevcut tüm ilanları "görülmüş" olarak kaydet
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
