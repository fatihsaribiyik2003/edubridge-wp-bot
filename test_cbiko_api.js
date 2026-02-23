const puppeteer = require('puppeteer');

async function run() {
    console.log("Launching headless browser to intercept APIs...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--ignore-certificate-errors'] });
    const page = await browser.newPage();

    let apiEndpoints = [];

    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('api') || request.url().includes('cbiko') || request.url().endsWith('.json')) {
            console.log("REQ:", request.url());
            apiEndpoints.push(request.url());
        }
        request.continue();
    });

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('api') && response.request().method() === 'GET') {
            try {
                const text = await response.text();
                if (text.includes('bilgisayar') || text.includes('ilan') || text.includes('title')) {
                    console.log("Found interesting response from:", url);
                    console.log("Snippet:", text.substring(0, 300));
                }
            } catch (e) { }
        }
    });

    console.log("Navigating...");
    await page.goto('https://isealimkariyerkapisi.cbiko.gov.tr/', { waitUntil: 'networkidle2' });

    await new Promise(r => setTimeout(r, 6000));

    await browser.close();
}

run().catch(console.error);
