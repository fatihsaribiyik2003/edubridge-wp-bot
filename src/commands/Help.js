module.exports = {
    name: '!komutlar',
    aliases: ['!help', '!yardım'],
    description: 'Tüm komutları listeler.',

    async execute(msg, client) {
        // Since we don't have direct access to the `commands` map in execute args in previous Bot.js, 
        // we might need to rely on the fact that we can pass it, or we can look at how Bot.js calls execute.
        // Bot.js call: await command.execute(msg, this.client);
        // It doesn't pass 'commands'. 
        // However, we can access it if we attach it to client, OR we can modify Bot.js to pass it.
        // EASIEST WAY: Attach commands to client in Bot.js or modify Bot.js.
        // Let's modify Bot.js to pass `this.commands` to execute.

        // Wait, better approach for now without modifying Bot.js again if possible:
        // Actually modifying Bot.js is cleaner.
        // Let's assume we will modify Bot.js to pass `this.commands` as the 3rd argument.

        // But wait, I can't modify Bot.js in this step easily without user interaction or making it a multi-step.
        // Let's check if I can access it via client? No, standard client doesn't have it.

        // LET'S MODIFY BOT.JS TO PASS COMMANDS OR ATTACH TO CLIENT.
        // I will update Bot.js to: this.client.commands = this.commands; 

        const commands = client.commands;
        if (!commands) {
            await msg.reply('❌ Komut listesine şu an ulaşılamıyor.');
            return;
        }

        let helpMessage = '*🤖 Bot Komut Listesi 🤖*\n\n';

        // Use a Set to avoid duplicate aliases
        const uniqueCommands = new Set();

        commands.forEach((cmd) => {
            // If the command is the main wrapper (like General.js handling multiple), we need to handle it.
            // General.js has name '!merhaba' but handles many.
            // Best way: Just list what we have.

            // If cmd has "aliases" that are also keys in the map, we might process them multiple times.
            // We should iterate the values of the checking unique objects.
            uniqueCommands.add(cmd);
        });

        for (const cmd of uniqueCommands) {
            if (cmd.name === '!merhaba') {
                // Special handling for General.js which is a bundle
                helpMessage += `🔹 *!merhaba* - Bot ile tanışır.\n`;
                helpMessage += `🔹 *!bot* - Bot durumunu kontrol eder.\n`;
                helpMessage += `🔹 *!ping* - "pong" yazar (Hız testi).\n`;
                helpMessage += `🔹 *!echo <mesaj>* - Mesajınızı tekrarlar.\n`;
                helpMessage += `🔹 *!info* - Bağlantı bilgilerini gösterir.\n`;
                helpMessage += `🔹 *!preview <link>* - Link önizlemesi oluşturur.\n`;
            }
            else if (cmd.name === '!asistan') {
                helpMessage += `🔹 *!asistan <soru>* - Yapay zeka asistanına soru sorar.\n`;
            }
            else if (cmd.name === '!gemini') {
                helpMessage += `🔹 *!gemini <soru>* - Google Gemini yapay zekasına soru sorar.\n`;
            }
            else if (cmd.name === '!duyuru') {
                helpMessage += `🔹 *!duyuru* - ${cmd.description || 'Duyuru sistemi.'}\n`;
            }
            else if (cmd.command === '!butik') {
                helpMessage += `🔹 *!butik* - Butik ürünlerini sorgular.\n`;
            }
            else if (cmd.command === '!rodos') {
                helpMessage += `🔹 *!rodos* - Rodos veritabanında arama yapar.\n`;
            }
            else if (cmd.command === '!sados') {
                helpMessage += `🔹 *!sados* - Sados sistemini sorgular.\n`;
            }
            else {
                // Fallback
                if (cmd.name && !['!merhaba', '!asistan', '!gemini', '!duyuru'].includes(cmd.name)) {
                    helpMessage += `🔹 *${cmd.name}* - ${cmd.description || 'Bir komut.'}\n`;
                }
            }
        }

        helpMessage += `\nℹ️ *Detaylı bilgi için komut adını yazabilirsiniz.*`;

        await msg.reply(helpMessage);
    }
};
