const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

class Bot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: process.platform === 'win32' ?
                    ['--no-sandbox', '--disable-setuid-sandbox'] : // Windows: Minimal args
                    [ // Linux/VPS: Robust args
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ],
                executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined
            },
        });

        this.commands = new Map();
        this.client.handoffStates = new Map();
        this.client.commands = this.commands; // Expose commands to client
    }

    initialize() {
        this.loadCommands();
        this.registerEvents();
        this.setupGracefulShutdown();
        this.client.initialize();
    }

    loadCommands() {
        const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`../commands/${file}`);

            // Support both standard exports and class instances
            const cmdName = command.name || command.command;

            if (cmdName) {
                this.commands.set(cmdName, command);
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

            // Initialize commands that have an init method (like Duyuru)
            this.commands.forEach(command => {
                if (typeof command.init === 'function') {
                    command.init(this.client);
                }
            });

            this.client.sendMessage('905387994516@c.us', 'Bot çalıştı 🚀', { sendSeen: false });
        });

        this.client.on('message', (msg) => this.handleMessage(msg));
        this.client.on('message_create', (msg) => {
            if (msg.fromMe) this.handleMessage(msg);
        });
    }

    async handleMessage(msg) {
        if (!msg.body) return;

        // Ignore group messages (Privacy & Spam prevention)
        if (msg.from.endsWith('@g.us')) return;

        // Command parsing
        const args = msg.body.split(' ');
        const commandName = args[0].toLowerCase();

        if (this.commands.has(commandName)) {
            try {
                const command = this.commands.get(commandName);
                await command.execute(msg, this.client);
            } catch (error) {
                console.error(`Komut hatası (${commandName}):`, error);
                msg.reply('❌ Bir hata oluştu.');
            }
        }
        else {
            for (const [name, command] of this.commands.entries()) {
                // Check for isPrefix or simple startsWith logic if command object allows it
                // Re-aligned with previous logic:
                if ((command.isPrefix || command.command) && msg.body.toLowerCase().startsWith(name)) {
                    // Check exact match first
                    if (this.commands.has(commandName) && this.commands.get(commandName) === command) continue;

                    try {
                        await command.execute(msg, this.client);
                        return; // Execute only one
                    } catch (error) {
                        console.error(`Komut hatası (${name}):`, error);
                    }
                }
            }
        }
    }

    setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            console.log('⚠️ Kapatılıyor... (SIGINT)');
            await this.client.destroy();
            console.log('✅ Bot ve tarayıcı kapatıldı.');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('⚠️ Kapatılıyor... (SIGTERM)');
            await this.client.destroy();
            console.log('✅ Bot ve tarayıcı kapatıldı.');
            process.exit(0);
        });
    }
}

module.exports = Bot;
