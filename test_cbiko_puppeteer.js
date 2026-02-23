const puppeteer = require('puppeteer');

async function run() {
    console.log("Launching headless browser...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--ignore-certificate-errors', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    console.log("Navigating to Kariyer Kapısı...");
    await page.goto('https://isealimkariyerkapisi.cbiko.gov.tr/', { waitUntil: 'networkidle2' });

    // Kariyer kapısı uses <div class="card..."> or similar to show active advertisements.
    // Let's get the whole body text or specific anchor texts.

    console.log("Waiting for network idle or 5 seconds...");
    await new Promise(r => setTimeout(r, 5000));

    const html = await page.content();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    let links = [];
    $('a').each((i, el) => {
        let text = $(el).text().trim().replace(/\\s+/g, ' ');
        let href = $(el).attr('href');
        if (text && href && (text.toLowerCase().includes('personel') || text.toLowerCase().includes('alım') || text.toLowerCase().includes('başvuru'))) {
            links.push({ text, href });
        }
    });

    console.log(`Found ${links.length} potential ads.`);
    console.log(links.slice(0, 15));

    await browser.close();
}

run().catch(console.error);
