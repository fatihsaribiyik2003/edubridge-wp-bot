const fs = require('fs');
const { execSync } = require('child_process');
try {
    execSync('node -c "src/commands/akademik ilan duyuru takip/DuyuruTakip.js"');
    console.log("No syntax error.");
} catch (e) {
    fs.writeFileSync('error_log.json', JSON.stringify({ stderr: e.stderr ? e.stderr.toString() : e.message }));
}
