const puppeteer = require('puppeteer');

async function run() {
    console.log("Launching headless browser...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--ignore-certificate-errors', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    console.log("Navigating to Kariyer Kapısı...");
    await page.goto('https://isealimkariyerkapisi.cbiko.gov.tr/', { waitUntil: 'networkidle0', timeout: 60000 });

    console.log("Waiting for network idle or 10 seconds...");
    await new Promise(r => setTimeout(r, 10000));

    const text = await page.evaluate(() => document.body.innerText);

    console.log("Length of body text:", text.length);
    console.log("Snippet:");
    console.log(text.substring(0, 1000));

    await browser.close();
}

run().catch(console.error);
