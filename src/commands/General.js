module.exports = {
    name: '!merhaba',
    aliases: ['!bot', '!info', '!chats', '!ping', '!echo', '!preview'],
    isPrefix: true, // To handle commands differently if needed, but for simple ones exact match is usually fine. 
    // However, we merged many into one file, so we need to switch on body.

    async execute(msg, client) {
        const body = msg.body.split(' ')[0].toLowerCase();

        if (body === '!merhaba') {
            msg.reply('merhaba ben fatihin özel botuyum', undefined, { sendSeen: false });
        } else if (body === '!bot') {
            msg.reply('bot aktif', undefined, { sendSeen: false });
        } else if (body === '!ping') {
            if (msg.body === '!ping reply') {
                msg.reply('pong');
            } else {
                const chat = await msg.getChat();
                chat.sendMessage('pong');
            }
        } else if (msg.body.startsWith('!echo ')) {
            msg.reply(msg.body.slice(6));
        } else if (msg.body === '!info') {
            const info = client.info;
            client.sendMessage(msg.from, `
                *Connection info*
                User name: ${info.pushname}
                My number: ${info.wid.user}
                Platform: ${info.platform}
            `);
        } else if (msg.body === '!chats') {
            const chats = await client.getChats();
            client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
        } else if (msg.body.startsWith('!preview ')) {
            const text = msg.body.slice(9);
            msg.reply(text, null, { linkPreview: true });
        }
    }
};
