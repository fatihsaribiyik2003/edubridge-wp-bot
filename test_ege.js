const fetch = require('node-fetch');
const cheerio = require('cheerio');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    const res = await fetch('https://personeldb.ege.edu.tr/tr-1616/duyurular.html', { agent: httpsAgent });
    const html = await res.text();
    const $ = cheerio.load(html);

    const keywords = ['öğretim elemanı', 'öğretim üyesi', 'akademik', 'personel', 'sözleşmeli', 'araştırma görevlisi', 'doçent', 'profesör', 'öğretim görevlisi', 'kadro ilanı', 'ilanı', 'ilanları', 'alım', 'atama', 'sonuç', 'yerleştirme', 'sürekli işçi'];
    const excludeWords = ['yönetmelik', 'yönerge', 'mevzuat', 'rehber', 'form', 'dilekçe', 'iletişim', 'telefon', 'adres', 'ebys', 'e-posta', 'harita', 'kurumsal', 'misyon', 'vizyon', 'tarihçe', 'öğrenci', 'yemek', 'burs', 'sempozyum', 'tören', 'kongre', 'konferans', 'şenlik', 'festival', 'spor', 'mezuniyet', 'ders', 'sınav takvimi', 'akademik takvim', 'yatay geçiş', 'yüksek lisans', 'doktora', 'uzaktan eğitim', 'anasayfa', 'ana sayfa', 'hakkımızda', 'personel listesi', 'devamını oku', 'tüm duyurular', 'organizasyon', 'faaliyet raporu', 'hizmet', 'iş akış', 'şeması', 'teşkilat', 'kalite', 'politikaları', 'başkanı', 'şube müdürlüğü', 'işlemleri', 'koşulları'];

    $('a').each((_, el) => {
        const text = $(el).text().trim().replace(/\\s+/g, ' ');
        const lowerText = text.toLowerCase();
        let href = $(el).attr('href');

        if (!href || href === '#' || href === '/' || href.startsWith('javascript:')) return;

        // "Misyon ve Vizyon" vs neden geçiyor görelim:
        if (text.includes("Misyon") || text.includes("Tarihçe")) {
            console.log(`BULDUM: "${text}"`);
            console.log(`-- includes keyword?`, keywords.some(k => lowerText.includes(k)));
            console.log(`-- matching keywords:`, keywords.filter(k => lowerText.includes(k)));
            console.log(`-- includes exclude?`, excludeWords.some(k => lowerText.includes(k)));
            console.log(`-- matching excludes:`, excludeWords.filter(k => lowerText.includes(k)));
        }
    });

}
run();
