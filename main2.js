const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const axios = require('axios'); // To send HTTP requests

const client = new Client({
    authStrategy: new LocalAuth()
});

const messageLogFile = 'messages.json';
let messageLog = {};

// Load existing message log
if (fs.existsSync(messageLogFile)) {
    messageLog = JSON.parse(fs.readFileSync(messageLogFile));
}

// Helper function to get current timestamp
function getTimestamp() {
    return Math.floor(Date.now() / 1000);
}

// Function to check if welcome was sent in the last 24 hours
function shouldSendWelcome(user) {
    const lastWelcome = messageLog[user]?.lastWelcome || 0;
    const currentTime = getTimestamp();
    return (currentTime - lastWelcome) > 86400; // 24 hours in seconds
}

// Save message log to JSON file
function saveMessageLog() {
    fs.writeFileSync(messageLogFile, JSON.stringify(messageLog, null, 2));
}

// Function to send the last three messages to the Ollama API
async function sendMessagesToOllama(messages) {
    const url = 'http://localhost:11434/api/generate';
    const data = {
        model: 'llama3.1', // Replace with the desired model name
        messages: messages
    };

    try {
        const response = await axios.post(url, data);
        if (response.status === 200) {
            return response.data.content; // Assuming the response has a 'content' field
        }
        throw new Error('Non-200 response from Ollama');
    } catch (error) {
        console.error('Error communicating with Ollama:', error.message);
        return 'An error occurred while processing your request.';
    }
}

// Function to format the last three messages for Ollama API
function formatMessagesForOllama(user) {
    const history = messageLog[user].messages.slice(-3); // Get the last 3 messages
    return history.map(entry => ({
        role: entry.isBot ? 'assistant' : 'user',
        content: entry.message
    }));
}

// Function to handle user states
async function handleUserState(user, msg) {
    const userState = messageLog[user].state;
    const message = msg.body.trim().toLowerCase();

    // Check if the user wants to exit the current state
    if (message === 'exit' || message === 'goodbye') {
        messageLog[user].state = null;
        msg.reply('You have exited the current session. How can we assist you next?');
        saveMessageLog();
        return;
    }

    // Handle responses based on the current state
    switch (userState) {
        case 'online_teaches':
            const formattedMessages = formatMessagesForOllama(user);
            const ollamaResponse = await sendMessagesToOllama(formattedMessages);
            msg.reply(`Ollama says: ${ollamaResponse}`);
            break;
        case 'support':
            msg.reply('You are in the Support section. Please describe your issue.');
            break;
        case 'payment':
            msg.reply('You are in the Payment section. Please provide payment details or ask your question.');
            break;
        default:
            msg.reply('Please select an option:\n1. Online Teaches\n2. Support\n3. Payment');
            break;
    }
    saveMessageLog();
}

// Function to handle new messages
client.on('message', async msg => {
    const user = msg.from;
    if (!messageLog[user]) {
        messageLog[user] = { lastWelcome: 0, messages: [], state: null };
    }

    // Check if we should send a welcome message
    if (shouldSendWelcome(user)) {
        messageLog[user].lastWelcome = getTimestamp();
        msg.reply('Welcome! How can we assist you today?');
        saveMessageLog();
        return;
    }

    // If the user is in a session, handle their state
    if (messageLog[user].state) {
        handleUserState(user, msg);
        return;
    }

    // Send menu options if the user is not in a session
    const option = msg.body.trim();
    if (option === '1' || option === '2' || option === '3') {
        switch (option) {
            case '1':
                messageLog[user].state = 'online_teaches';
                msg.reply(`Hello ${msg._data.notifyName}, welcome to the Online Teaches section.`);
                break;
            case '2':
                messageLog[user].state = 'support';
                msg.reply('Welcome to the Support section. How can we help you?');
                break;
            case '3':
                messageLog[user].state = 'payment';
                msg.reply('Welcome to the Payment section. Please provide your payment details.');
                break;
        }

        // Log the message and keep only the last 3
        messageLog[user].messages.push({ timestamp: getTimestamp(), message: msg.body, isBot: false });
        if (messageLog[user].messages.length > 3) {
            messageLog[user].messages = messageLog[user].messages.slice(-3);
        }
        saveMessageLog();
    } else {
        // Handle invalid options
        msg.reply('Invalid option. Please select:\n1. Online Teaches\n2. Support\n3. Payment');
    }
});

// QR Code generation for authentication
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Start the client
client.initialize();
