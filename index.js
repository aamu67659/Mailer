const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/send-bulk', async (req, res) => {
    const { 
        emails, 
        subject, 
        message, 
        senderName, 
        emailDelay = 1000, 
        pauseAfter = 10, 
        pauseDuration = 5000 
    } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'Email list is required' });
    }

    // Set up transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // Verify connection configuration
    try {
        await transporter.verify();
    } catch (error) {
        console.error('SMTP Connection Error:', error);
        return res.status(500).json({ error: 'Failed to connect to SMTP server. Check your .env configuration.' });
    }

    // For real-time updates, we'll use a simple approach: send the response at the end
    // For very large lists, a task queue or SSE would be better, but we'll stick to simple for now.
    const results = [];
    let sentCount = 0;

    // Use a separate async process if you want to return immediately, 
    // but here we wait to give the user the final status.
    for (let i = 0; i < emails.length; i++) {
        const email = emails[i].trim();
        if (!email) continue;

        try {
            await transporter.sendMail({
                from: `"${senderName}" <${process.env.SMTP_USER}>`,
                to: email,
                subject: subject,
                text: message,
            });
            results.push({ email, status: 'sent' });
            sentCount++;
        } catch (error) {
            console.error(`Error sending to ${email}:`, error);
            results.push({ email, status: 'failed', error: error.message });
        }

        // Delay logic
        if (i < emails.length - 1) {
            if (sentCount > 0 && sentCount % pauseAfter === 0) {
                await sleep(pauseDuration);
            } else {
                await sleep(emailDelay);
            }
        }
    }

    res.json({ message: 'Process completed', results, totalSent: sentCount });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
