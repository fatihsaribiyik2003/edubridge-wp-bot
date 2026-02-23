const fetch = require('node-fetch');
const https = require('https');
const cheerio = require('cheerio');

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    try {
        const url = 'https://isealimkariyerkapisi.cbiko.gov.tr/';
        console.log(`Connecting to ${url}`);
        const res = await fetch(url, { agent });
        const html = await res.text();
        const $ = cheerio.load(html);

        let foundStrings = [];
        $('a').each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (text && href) {
                foundStrings.push(`[${text}] -> ${href}`);
            }
        });

        // CBiKo usually renders list of ads in tabs or specific divs like .advertisement
        // We will just print some anchors to see if it's SSR or SPA
        console.log("Total links found:", foundStrings.length);
        console.log(foundStrings.slice(0, 20).join('\n'));

    } catch (e) {
        console.error("Error:", e);
    }
}
run();
