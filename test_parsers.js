const fetch = require('node-fetch');
const cheerio = require('cheerio');

const universities = [
    { name: 'SUBÜ', url: 'https://ilan.subu.edu.tr/' },
    { name: 'İTÜ', url: 'https://www.itu.edu.tr/duyurular/' },
    { name: 'Kocaeli', url: 'https://kocaeli.edu.tr/duyuru-ve-etkinlikler' },
    { name: 'Ege', url: 'https://personel.ege.edu.tr/' },
    { name: 'Düzce', url: 'https://personel.duzce.edu.tr/' },
    { name: 'Bursa', url: 'https://uludag.edu.tr/personel/ilanlar' },
    { name: 'Çukurova', url: 'https://personel.cu.edu.tr/' }
];

async function testParsers() {
    for (const uni of universities) {
        try {
            console.log(`\n--- Fetching ${uni.name} ---`);
            const response = await fetch(uni.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'tr-TR,tr;q=0.9'
                },
                timeout: 10000
            });
            const html = await response.text();
            const $ = cheerio.load(html);

            const announcements = [];
            let baseUrl = new URL(uni.url).origin;

            $('a').each((_, el) => {
                const text = $(el).text().trim().toLowerCase();
                let href = $(el).attr('href');

                if (!href || href === '#' || href === '/') return;

                const keywords = ['öğretim', 'akademik', 'ilan', 'araştırma', 'doçent', 'profesör', 'görevli', 'personel alım', 'öğretim elemanı', 'sınav'];
                const excludeWords = ['yönetmelik', 'yönerge', 'mevzuat', 'rehber', 'form', 'dilekçe', 'iletişim', 'telefon', 'adres', 'ebys'];

                if (keywords.some(k => text.includes(k)) && !excludeWords.some(k => text.includes(k)) && text.length > 5 && text.length < 200) {
                    let fullUrl = href;
                    if (href.startsWith('/')) {
                        fullUrl = baseUrl + href;
                    } else if (!href.startsWith('http')) {
                        // resolve relative correctly
                        fullUrl = new URL(href, uni.url).href;
                    }

                    if (!announcements.some(a => a.url === fullUrl)) {
                        announcements.push({
                            title: $(el).text().trim().replace(/\s+/g, ' '),
                            url: fullUrl
                        });
                    }
                }
            });

            console.log(`Found ${announcements.length} announcements for ${uni.name}`);
            if (announcements.length > 0) {
                console.log(announcements.slice(0, 3));
            } else {
                console.log("-> Try dumping some raw links to see what went wrong...");
                let debugLinks = [];
                $('a').each((_, el) => {
                    if ($(el).text().length > 10) debugLinks.push($(el).text().trim().replace(/\s+/g, ' '));
                });
                console.log("Sample links:", debugLinks.slice(0, 10));
            }
        } catch (e) {
            console.error(`Error for ${uni.name}: ${e.message}`);
        }
    }
}
testParsers();
