const fs = require('fs');
require('dotenv').config();
const { Client, Location, Poll, List, Buttons, LocalAuth } = require('whatsapp-web.js');
const schedule = require('node-schedule');
const qrcode = require('qrcode-terminal');
const GeminiService = require('./src/services/GeminiService');
const fetch = require('node-fetch');

const gemini = new GeminiService(process.env.GEMINI_API_KEY);

// --- Helper Functions for Scheduled Announcements ---
let activeAnnouncements = [];

const loadAnnouncements = () => {
    try {
        if (fs.existsSync('./announcements.json')) {
            const data = fs.readFileSync('./announcements.json', 'utf8');
            activeAnnouncements = JSON.parse(data);
            // console.log(`Yüklenen duyuru işleri: ${activeAnnouncements.length} adet`);

            // Re-schedule existing jobs
            activeAnnouncements.forEach(job => {
                scheduleAnnouncementJob(job);
            });
        }
    } catch (err) {
        console.error('Duyurular yüklenirken hata:', err);
    }
};

const saveAnnouncements = () => {
    try {
        fs.writeFileSync('./announcements.json', JSON.stringify(activeAnnouncements, null, 2));
    } catch (err) {
        console.error('Duyurular kaydedilirken hata:', err);
    }
};

const scheduleAnnouncementJob = (job) => {
    // Parse HH:mm to cron (every day at HH:mm)
    const [hour, minute] = job.time.split(':');
    const cronExpression = `${minute} ${hour} * * *`;

    schedule.scheduleJob(job.id, cronExpression, async function () {
        // console.log(`Duyuru parça gönderimi başladı (Job ID: ${job.id})`);
        await processAnnouncementBatch(job);
    });
    // console.log(`Duyuru zamanlandı: ${job.time} (ID: ${job.id})`);
};

const processAnnouncementBatch = async (job) => {
    let sentCount = 0;
    let failCount = 0;

    // Check if job is finished
    if (job.nextIndex >= job.numbers.length) {
        // console.log(`Duyuru işi tamamlanmış (ID: ${job.id}). Listeden siliniyor.`);
        // Remove job and cancel schedule
        const currentJob = schedule.scheduledJobs[job.id];
        if (currentJob) currentJob.cancel();

        activeAnnouncements = activeAnnouncements.filter(j => j.id !== job.id);
        saveAnnouncements();
        return;
    }

    const endIndex = Math.min(job.nextIndex + job.batchSize, job.numbers.length);
    const batch = job.numbers.slice(job.nextIndex, endIndex);

    // console.log(`Batch gönderiliyor: ${batch.length} kişi (${job.nextIndex} - ${endIndex})`);

    for (let num of batch) {
        // Numara formatlama
        let formattedNum = num.trim().replace(/\D/g, '');
        if (formattedNum.length === 10) formattedNum = '90' + formattedNum;
        else if (formattedNum.length === 11 && formattedNum.startsWith('0')) formattedNum = '90' + formattedNum.substring(1);

        const finalId = formattedNum.includes('@c.us') ? formattedNum : formattedNum + '@c.us';

        try {
            await client.sendMessage(finalId, job.message);
            sentCount++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sec delay
        } catch (err) {
            console.error(`Mesaj gitmedi (${finalId}):`, err);
            failCount++;
        }
    }


    // console.log(`Batch tamamlandı. Başarılı: ${sentCount}, Hata: ${failCount}`);

    // Update job state

    // Update job state
    job.nextIndex = endIndex;

    // If completed
    if (job.nextIndex >= job.numbers.length) {
        // console.log(`Duyuru işi TAMAMLANDI (ID: ${job.id}).`);
        const currentJob = schedule.scheduledJobs[job.id];
        if (currentJob) currentJob.cancel();
        activeAnnouncements = activeAnnouncements.filter(j => j.id !== job.id);
    } else {
        // Update the job in the array just to be safe (though object reference should work)
        const jobIndex = activeAnnouncements.findIndex(j => j.id === job.id);
        if (jobIndex !== -1) activeAnnouncements[jobIndex] = job;
    }

    saveAnnouncements();
};


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true, // Tarayıcı görünmez (arka planda) çalışacak
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined
    },
});

// client initialize does not finish at ready now.
client.initialize();

client.on('loading_screen', (percent, message) => {
    // console.log('LOADING SCREEN', percent, message);
});

client.on('qr', async (qr) => {
    // QR Kodu terminale basılıyor
    console.log('QR Kodu alındı, lütfen taratın:');
    qrcode.generate(qr, { small: true });
});

client.on('code', (code) => {
    // console.log('Pairing code:', code);
});

client.on('authenticated', () => {
    // console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', async () => {
    // console.log('READY');
    loadAnnouncements(); // Kayıtlı duyuruları yükle

    const debugWWebVersion = await client.getWWebVersion();
    // console.log(`WWebVersion = ${debugWWebVersion}`);

    // Startup notification
    client.sendMessage('905387994516@c.us', 'Bot çalıştı 🚀', { sendSeen: false });

    if (client.pupPage) {
        client.pupPage.on('pageerror', function (err) {
            console.log('Page error: ' + err.toString());
        });
        client.pupPage.on('error', function (err) {
            console.log('Page error: ' + err.toString());
        });
    }

    console.log('Bot kullanıma hazır!');
});

// Komut işleme fonksiyonu
const handleMessage = async (msg) => {
    // console.log('MESSAGE RECEIVED', msg.body);

    if (msg.body === '!merhaba') {
        msg.reply('merhaba ben fatihin özel botuyum', undefined, { sendSeen: false });
    } else if (msg.body === '!bot') {
        msg.reply('bot aktif', undefined, { sendSeen: false });
    } else if (msg.body.startsWith('!gemini ') || msg.body.startsWith('!ai ')) {
        const prompt = msg.body.replace(/^!(gemini|ai) /, '');
        msg.reply('Gemini düşünüyor... 🧠');
        const response = await gemini.generateResponse(prompt);
        msg.reply(response);
    } else if (msg.body === '!ping reply') {
        // Send a new message as a reply to the current one
        msg.reply('pong');

    } else if (msg.body === '!ping') {
        // Send a new message to the same chat
        const chat = await msg.getChat();
        chat.sendMessage('pong');

    } else if (msg.body === '!bot') {
        msg.reply('bot aktif');

    } else if (msg.body === '!merhaba') {
        msg.reply('Merhaba ben fatihin tasarladığı özel botum');

    } else if (msg.body.startsWith('!butik ')) {
        const question = msg.body.slice(7).trim();
        if (!question) {
            msg.reply('Lütfen bir soru sorun. Örnek: !butik Kot pantolonların fiyatı nedir?');
            return;
        }

        try {
            const response = await fetch('http://fatih066.pythonanywhere.com/butik', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) {
                throw new Error(`API hatası: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.answer) {
                msg.reply(data.answer);
            } else {
                msg.reply('Bir cevap alınamadı.');
            }

        } catch (error) {
            console.error('Butik API hatası:', error);
            msg.reply('Üzgünüm, butik servisine ulaşırken bir hata oluştu.');
        }

    } else if (msg.body.startsWith('!sados ')) {
        const question = msg.body.slice(7).trim();
        if (!question) {
            msg.reply('Lütfen bir soru sorun. Örnek: !sados Dosyalarda ne anlatılıyor?');
            return;
        }

        try {
            const response = await fetch('http://fatih066.pythonanywhere.com/sados', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) {
                throw new Error(`API hatası: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.answer) {
                msg.reply(data.answer);
            } else {
                msg.reply('Bir cevap alınamadı.');
            }

        } catch (error) {
            console.error('Sados API hatası:', error);
            msg.reply('Üzgünüm, sados servisine ulaşırken bir hata oluştu.');
        }

    } else if (msg.body.startsWith('!rodos ')) {
        const question = msg.body.slice(7).trim();
        if (!question) {
            msg.reply('Lütfen bir soru sorun. Örnek: !rodos Veritabanındaki belgelerde neler anlatılıyor?');
            return;
        }

        try {
            const response = await fetch('https://fatih066.pythonanywhere.com/pdf/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) {
                throw new Error(`API hatası: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.answer) {
                let replyMsg = data.answer;
                if (data.sources && data.sources.length > 0) {
                    replyMsg += '\n\nKaynaklar:\n' + data.sources.join('\n');
                }
                msg.reply(replyMsg);
            } else {
                msg.reply('Bir cevap alınamadı.');
            }

        } catch (error) {
            console.error('Rodos API hatası:', error);
            msg.reply('Üzgünüm, Rodos servisine ulaşırken bir hata oluştu.');
        }



    } else if (msg.body.startsWith('!duyuru ')) {
        // Format: !duyuru gönderme_listesi(...) göderilecek_mesaj(...) [zaman(HH:mm) adet(N)]
        try {
            // Regex güncellemeleri: Boşluklara daha toleranslı ve büyük/küçük harf duyarsız (i)
            const listMatch = msg.body.match(/gönderme_listesi\s*\(([\d,.\s]+)\)/i);
            const contentMatch = msg.body.match(/göderilecek_mesaj\s*\(['"]?([^)]+)['"]?\)/i);
            const timeMatch = msg.body.match(/zaman\s*\(([\d:]+)\)/i);
            const batchMatch = msg.body.match(/adet\s*\(([\d]+)\)/i);

            if (listMatch && contentMatch) {
                // Numaraları temizle ve ayır
                let rawNumbers = listMatch[1].replace(/\./g, ',').split(',');
                let messageContent = contentMatch[1];
                let numbers = [];

                for (let num of rawNumbers) {
                    num = num.trim().replace(/\D/g, '');
                    if (num.length > 0) {
                        let formattedNum = num;
                        if (num.length === 10) formattedNum = '90' + num;
                        else if (num.length === 11 && formattedNum.startsWith('0')) formattedNum = '90' + formattedNum.substring(1);

                        numbers.push(formattedNum.includes('@c.us') ? formattedNum : formattedNum + '@c.us');
                    }
                }

                if (timeMatch) {
                    // --- ZAMANLANMIŞ DUYURU MODU ---
                    const time = timeMatch[1];
                    // Adet belirtilmediyse hepsini seç (liste uzunluğu)
                    const batchSize = batchMatch ? parseInt(batchMatch[1]) : numbers.length;

                    const newJob = {
                        id: `job_${Date.now()}`,
                        numbers: numbers,
                        message: messageContent,
                        time: time,
                        batchSize: batchSize,
                        nextIndex: 0
                    };

                    activeAnnouncements.push(newJob);
                    saveAnnouncements();
                    scheduleAnnouncementJob(newJob);

                    const chat = await msg.getChat();
                    chat.sendMessage(`✅ Zamanlanmış Duyuru Oluşturuldu!\n\n🕒 Zaman: Her gün ${time}\n📦 Paket Boyutu: ${batchSize} kişi\n👥 Toplam Kişi: ${numbers.length}\n🆔 Job ID: ${newJob.id}`);

                } else {
                    // --- ANLIK GÖNDERİM MODU (Eski yöntem) ---
                    let successCount = 0;
                    let failCount = 0;

                    const chat = await msg.getChat();
                    await chat.sendMessage(`📢 Anlık duyuru işlemi başlatıldı. ${numbers.length} kişiye gönderilecek...`);

                    for (const finalId of numbers) {
                        try {
                            await client.sendMessage(finalId, messageContent);
                            successCount++;
                            // Spam olmaması için kısa bekleme
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (err) {
                            console.error(`Mesaj gönderilemedi (${finalId}):`, err);
                            failCount++;
                        }
                    }
                    await chat.sendMessage(`✅ Duyuru tamamlandı.\nBaşarılı: ${successCount}\nBaşarısız: ${failCount}`);
                }

            } else {
                const chat = await msg.getChat();
                chat.sendMessage('❌ Hatalı format!\nDoğru kullanım:\n!duyuru gönderme_listesi(...) göderilecek_mesaj(...) [zaman(HH:mm) adet(N)]');
            }
        } catch (e) {
            console.error('Duyuru hatası:', e);
            const chat = await msg.getChat();
            chat.sendMessage('❌ Bir hata oluştu: ' + e.message);
        }

    } else if (msg.body.startsWith('!toplumesaj ')) {
        // Format: !toplumesaj (5301234567, 5321234567) Merhaba Dünya
        try {
            const match = msg.body.match(/!toplumesaj\s*\(([^)]+)\)\s*(.+)/s);

            if (match) {
                const numbersStr = match[1];
                const message = match[2];
                const numbers = numbersStr.split(',').map(n => n.trim().replace(/\D/g, '')).filter(n => n.length > 0);

                if (numbers.length === 0) {
                    msg.reply('❌ Hiçbir geçerli numara bulunamadı.');
                    return;
                }

                msg.reply(`📢 ${numbers.length} kişiye mesaj gönderimi başlıyor...`);

                let success = 0;
                let fail = 0;

                for (let num of numbers) {
                    // Numara formatlama (90 ekleme)
                    if (num.length === 10) num = '90' + num;
                    else if (num.length === 11 && num.startsWith('0')) num = '90' + num.substring(1);

                    const chatId = num.includes('@c.us') ? num : num + '@c.us';

                    try {
                        await client.sendMessage(chatId, message);
                        success++;
                        await new Promise(r => setTimeout(r, 1000)); // 1 sn bekleme
                    } catch (err) {
                        console.error(`Gönderim hatası (${num}):`, err.message);
                        fail++;
                    }
                }

                msg.reply(`✅ Gönderim tamamlandı.\nBaşarılı: ${success}\nBaşarısız: ${fail}`);

            } else {
                msg.reply('❌ Hatalı format!\nDoğru kullanım: `!toplumesaj (5551234567, 5559876543) Mesajınız buraya`');
            }
        } catch (e) {
            console.error('Toplu mesaj hatası:', e);
            msg.reply('❌ Bir hata oluştu.');
        }

        /* } else if (msg.body.startsWith('!sendto ')) {
            // Direct send a new message to specific id
            let number = msg.body.split(' ')[1];
            let messageIndex = msg.body.indexOf(number) + number.length;
            let message = msg.body.slice(messageIndex, msg.body.length);
            number = number.includes('@c.us') ? number : `${number}@c.us`;
            let chat = await msg.getChat();
            client.sendMessage(number, message, { sendSeen: false }); */

    } else if (msg.body.startsWith('!echo ')) {
        // Replies with the same message
        msg.reply(msg.body.slice(6));
    } else if (msg.body.startsWith('!preview ')) {
        const text = msg.body.slice(9);
        msg.reply(text, null, { linkPreview: true });
    } else if (msg.body === '!chats') {
        const chats = await client.getChats();
        client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
    } else if (msg.body === '!info') {
        let info = client.info;
        client.sendMessage(msg.from, `
            *Connection info*
            User name: ${info.pushname}
            My number: ${info.wid.user}
            Platform: ${info.platform}
        `);
    } else if (msg.location) {
        msg.reply(msg.location);
    }

};

client.on('message', handleMessage);
client.on('message_create', (msg) => {
    // Kendi attığınız mesajları da aynı fonksiyona yönlendiriyoruz
    if (msg.fromMe) {
        handleMessage(msg);
    }
});

client.on('message_ciphertext', (msg) => {
    // Receiving new incoming messages that have been encrypted
    // msg.type === 'ciphertext'
    msg.body = 'Waiting for this message. Check your phone.';

    // do stuff here
});

client.on('message_revoke_everyone', async (after, before) => {
    // Fired whenever a message is deleted by anyone (including you)
    // console.log(after); // message after it was deleted.
    if (before) {
        // console.log(before); // message before it was deleted.
    }
});

client.on('message_revoke_me', async (msg) => {
    // Fired whenever a message is only deleted in your own view.
    // console.log(msg.body); // message before it was deleted.
});

client.on('message_ack', (msg, ack) => {
    /*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

    if (ack == 3) {
        // The message was read
    }
});

// client.on('group_join', (notification) => {
//     // User has joined or been added to the group.
//     console.log('join', notification);
//     notification.reply('User joined.');
// });

// client.on('group_leave', (notification) => {
//     // User has left or been kicked from the group.
//     console.log('leave', notification);
//     notification.reply('User left.');
// });

client.on('group_update', (notification) => {
    // Group picture, subject or description has been updated.
    // console.log('update', notification);
});

client.on('change_state', state => {
    // console.log('CHANGE STATE', state);
});

// Change to false if you don't want to reject incoming calls
let rejectCalls = false;

client.on('call', async (call) => {
    // console.log('Call received, rejecting. GOTO Line 261 to disable', call);
    if (rejectCalls) await call.reject();
    await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});

client.on('disconnected', (reason) => {
    // console.log('Client was logged out', reason);
});

client.on('contact_changed', async (message, oldId, newId, isContact) => {
    /** The time the event occurred. */
    const eventTime = (new Date(message.timestamp * 1000)).toLocaleString();

    /* console.log(
        `The contact ${oldId.slice(0, -5)}` +
        `${!isContact ? ' that participates in group ' +
            `${(await client.getChatById(message.to ?? message.from)).name} ` : ' '}` +
        `changed their phone number\nat ${eventTime}.\n` +
        `Their new phone number is ${newId.slice(0, -5)}.\n`); */
});

client.on('group_admin_changed', (notification) => {
    if (notification.type === 'promote') {
        // console.log(`You were promoted by ${notification.author}`);
    } else if (notification.type === 'demote')
        // console.log(`You were demoted by ${notification.author}`);
        ;
});

client.on('group_membership_request', async (notification) => {
    // console.log(notification);
    // await client.approveGroupMembershipRequests(notification.chatId, notification.author);
    // await client.rejectGroupMembershipRequests(notification.chatId, notification.author);
});

client.on('message_reaction', async (reaction) => {
    // console.log('REACTION RECEIVED', reaction);
});

client.on('vote_update', (vote) => {
    // console.log(vote);
});

// Terminal Input Interface
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', async (line) => {
    // Trim and ignore empty lines
    line = line.trim();
    if (!line) return;

    // Split by first space to get number and message
    const firstSpaceIndex = line.indexOf(' ');
    if (firstSpaceIndex === -1) {
        console.log('Hata: Format yanlış. Kullanım: 905xxxxxxxxx Mesajınız');
        return;
    }

    let number = line.substring(0, firstSpaceIndex);
    const message = line.substring(firstSpaceIndex + 1);

    // Basic format check
    if (number.length < 10) {
        console.log('Hata: Numara çok kısa.');
        return;
    }

    // Append suffix if missing
    if (!number.includes('@c.us')) {
        number = `${number}@c.us`;
    }

    try {
        console.log(`Gönderiliyor: ${number} -> ${message}`);
        await client.sendMessage(number, message);
        console.log('✅ Mesaj gönderildi!');
    } catch (e) {
        console.error('❌ Gönderim başarısız:', e);
    }
});
