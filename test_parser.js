const fs = require('fs');
const AnnouncementService = require('./src/services/AnnouncementService');
const service = new AnnouncementService();

async function runTest() {
    let output = [];
    for (const uni of service.universities) {
        let uniObj = { name: uni.shortName, url: uni.url, count: 0, items: [], error: null };
        try {
            const results = await service.checkUniversity(uni);
            uniObj.count = results.length;
            uniObj.items = results.slice(0, 5);
        } catch (e) {
            uniObj.error = e.message;
        }
        output.push(uniObj);
    }
    fs.writeFileSync('test_output.json', JSON.stringify(output, null, 2), 'utf8');
    console.log("TEST_FINISHED");
}

runTest();
