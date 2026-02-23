const puppeteer = require('puppeteer');

async function run() {
    console.log("Launching headless...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--ignore-certificate-errors', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    console.log("Navigating...");
    await page.goto('https://isealimkariyerkapisi.cbiko.gov.tr/', { waitUntil: 'networkidle0', timeout: 60000 });

    console.log("Waiting 10s...");
    await new Promise(r => setTimeout(r, 10000));

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim().replace(/\\s+/g, ' '),
            href: a.href
        })).filter(l => l.text.length > 5);
    });

    console.log(`Found ${links.length} links`);
    let ads = links.filter(l => l.href && l.href.includes('isealimkariyerkapisi.cbiko.gov.tr') && !l.href.includes('giris') && !l.href.includes('kayit'));

    console.log(ads.slice(0, 30));

    await browser.close();
}

run().catch(console.error);
