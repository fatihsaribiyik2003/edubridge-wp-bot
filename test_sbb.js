const fetch = require('node-fetch');
const cheerio = require('cheerio');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    try {
        console.log("Fetching SBB Kamu İlanları...");
        const res = await fetch('https://kamuilan.sbb.gov.tr/', { agent });
        const html = await res.text();
        const $ = cheerio.load(html);

        let sbbLinks = [];
        // SBB ilanları genellikle <a href="ilanDetay.aspx?kod=..."> şeklindeki linklerde olur.
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim().replace(/\\s+/g, ' ');

            if (href && href.includes('ilanDetay.aspx')) {
                let fullUrl = href.startsWith('http') ? href : 'https://kamuilan.sbb.gov.tr/' + href;
                if (!sbbLinks.some(l => l.url === fullUrl)) {
                    sbbLinks.push({ title: text, url: fullUrl });
                }
            }
        });

        console.log(`Found ${sbbLinks.length} active announcements on SBB.`);

        // Sadece 3 tanesinin içine girip kelime kontrolü yapalım (test amaçlı)
        let testLinks = sbbLinks.slice(0, 3);
        console.log("Checking 3 detail pages for computer engineering terms...");

        for (const link of testLinks) {
            console.log(`\nChecking: ${link.title}\nURL: ${link.url}`);
            try {
                const detailRes = await fetch(link.url, { agent });
                const detailHtml = await detailRes.text();
                const detail$ = cheerio.load(detailHtml);

                // .icerik veya sadece body
                const bodyText = detail$('body').text().toLowerCase();

                const hasComputerEngineer = bodyText.includes('bilgisayar mühendis') || bodyText.includes('bilgisayar muhendis');
                console.log(`--> Has CE: ${hasComputerEngineer}`);

            } catch (e) {
                console.error("Detail Error:", e.message);
            }
        }

    } catch (e) {
        console.error("Main Error:", e);
    }
}

run();
