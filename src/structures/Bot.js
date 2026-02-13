const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const AnnouncementManager = require('../managers/AnnouncementManager');

class Bot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined
            },
        });

        this.commands = new Map();
        this.announcementManager = new AnnouncementManager(this.client);
        this.client.handoffStates = new Map();
    }

    initialize() {
        this.loadCommands();
        this.registerEvents();
        this.client.initialize();
    }

    loadCommands() {
        const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`../commands/${file}`);
            if (command.name) {
                this.commands.set(command.name, command);
            }
            if (command.aliases) {
                command.aliases.forEach(alias => this.commands.set(alias, command));
            }
        }
        console.log(`${this.commands.size} komut yüklendi.`);
    }

    registerEvents() {
        this.client.on('qr', (qr) => {
            console.log('QR Kodu alındı, lütfen taratın:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            console.log('Bot kullanıma hazır!');
            this.announcementManager.load();
            this.client.sendMessage('905387994516@c.us', 'Bot çalıştı 🚀', { sendSeen: false });
        });

        this.client.on('message', (msg) => this.handleMessage(msg));
        this.client.on('message_create', (msg) => {
            if (msg.fromMe) this.handleMessage(msg);
        });
    }

    async handleMessage(msg) {
        if (!msg.body) return;

        // Command parsing (very basic for now, can be improved)
        const args = msg.body.split(' ');
        const commandName = args[0].toLowerCase();

        if (this.commands.has(commandName)) {
            try {
                const command = this.commands.get(commandName);
                await command.execute(msg, this.client, this.announcementManager);
            } catch (error) {
                console.error(`Komut hatası (${commandName}):`, error);
                msg.reply('❌ Bir hata oluştu.');
            }
        }

        // Handle commands that start with text but have arguments (like !gemini, !ai)
        // This part needs to be more flexible. For now, let's iterate to check "startsWith" commands if exact match fails
        else {
            for (const [name, command] of this.commands.entries()) {
                if (command.isPrefix && msg.body.toLowerCase().startsWith(name)) {
                    try {
                        await command.execute(msg, this.client, this.announcementManager);
                        return; // Execute only one
                    } catch (error) {
                        console.error(`Komut hatası (${name}):`, error);
                    }
                }
            }
        }
    }
}

module.exports = Bot;
