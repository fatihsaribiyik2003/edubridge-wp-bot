const fs = require('fs');
const schedule = require('node-schedule');

class AnnouncementManager {
    constructor(client) {
        this.client = client;
        this.activeAnnouncements = [];
        this.filePath = './announcements.json';
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                this.activeAnnouncements = JSON.parse(data);
                // Re-schedule existing jobs
                this.activeAnnouncements.forEach(job => {
                    this.scheduleJob(job);
                });
            }
        } catch (err) {
            console.error('Duyurular yüklenirken hata:', err);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.activeAnnouncements, null, 2));
        } catch (err) {
            console.error('Duyurular kaydedilirken hata:', err);
        }
    }

    scheduleJob(job) {
        // Parse HH:mm to cron (every day at HH:mm)
        const [hour, minute] = job.time.split(':');
        const cronExpression = `${minute} ${hour} * * *`;

        schedule.scheduleJob(job.id, cronExpression, async () => {
            await this.processBatch(job);
        });
    }

    async processBatch(job) {
        let sentCount = 0;
        let failCount = 0;

        // Check if job is finished
        if (job.nextIndex >= job.numbers.length) {
            this.finishJob(job);
            return;
        }

        const endIndex = Math.min(job.nextIndex + job.batchSize, job.numbers.length);
        const batch = job.numbers.slice(job.nextIndex, endIndex);

        for (let num of batch) {
            // Number formatting
            let formattedNum = num.trim().replace(/\D/g, '');
            if (formattedNum.length === 10) formattedNum = '90' + formattedNum;
            else if (formattedNum.length === 11 && formattedNum.startsWith('0')) formattedNum = '90' + formattedNum.substring(1);

            const finalId = formattedNum.includes('@c.us') ? formattedNum : formattedNum + '@c.us';

            try {
                await this.client.sendMessage(finalId, job.message);
                sentCount++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sec delay
            } catch (err) {
                console.error(`Mesaj gitmedi (${finalId}):`, err);
                failCount++;
            }
        }

        // Update job state
        job.nextIndex = endIndex;

        // If completed
        if (job.nextIndex >= job.numbers.length) {
            this.finishJob(job);
        } else {
            // Update the job in the array
            const jobIndex = this.activeAnnouncements.findIndex(j => j.id === job.id);
            if (jobIndex !== -1) this.activeAnnouncements[jobIndex] = job;
            this.save();
        }
    }

    finishJob(job) {
        const currentJob = schedule.scheduledJobs[job.id];
        if (currentJob) currentJob.cancel();
        this.activeAnnouncements = this.activeAnnouncements.filter(j => j.id !== job.id);
        this.save();
    }

    addAnnouncement(job) {
        this.activeAnnouncements.push(job);
        this.save();
        this.scheduleJob(job);
    }
}

module.exports = AnnouncementManager;
