// Import CommonJS modules correctly
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import ollama from 'ollama'; // Ollama import using ES module syntax

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
});

// Event to generate QR code for login if cache doesn't exist
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Event when the client is ready
client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    checkForLatestMessage(); // Check latest message on startup
});

// Event for receiving messages
client.on('message', async (message) => {
    const contact = await message.getContact();
    const chat = await message.getChat();

    const messageData = {
        name: contact.pushname || contact.name || contact.number,
        number: contact.number,
        lastMessage: message.body,
        lastTalkedTo: new Date().toISOString()
    };

    // Log received message
    console.log(`Received message from ${messageData.name}: ${message.body}`);

    // Save message data to JSON and CSV
    saveMessageData(messageData);

    // Fetch last 2 messages from the same chat
    const messages = await chat.fetchMessages({ limit: 3 });
    const previousMessages = messages.slice(0, 2).map(msg => msg.body);
    previousMessages.push(message.body); // Include the current message

    // Prepare messages for Ollama API
    const ollamaMessages = previousMessages.map((msg, index) => {
        return { role: 'user', content: `message${index + 1}: ${msg}` };
    });

    // Call Ollama API with the collected messages
    try {
        const response = await ollama.chat({
            model: 'llama3.1',
            messages: ollamaMessages,
        });

        const ollamaResponse = response.message.content;
        
        // Log the AI's response to the console
        console.log(`Ollama's response: ${ollamaResponse}`);

        // Reply back to the user with Ollama's response
        await message.reply(ollamaResponse);
    } catch (error) {
        console.error('Error in Ollama chat:', error);
    }
});

// Check for the latest message on startup
async function checkForLatestMessage() {
    const chats = await client.getChats();
    if (chats.length > 0) {
        const lastChat = chats[chats.length - 1];
        const lastMessage = await lastChat.fetchMessages({ limit: 1 });
        if (lastMessage.length > 0) {
            console.log(`Latest message: ${lastMessage[0].body}`);
        }
    } else {
        console.log('No messages found.');
    }
}

// Save data to JSON and CSV
function saveMessageData(messageData) {
    // Save to JSON
    let jsonData = [];
    if (fs.existsSync('messages.json')) {
        jsonData = JSON.parse(fs.readFileSync('messages.json', 'utf-8'));
    }
    jsonData.push(messageData);
    fs.writeFileSync('messages.json', JSON.stringify(jsonData, null, 2), 'utf-8');

    // Save to CSV
    const csvWriter = createObjectCsvWriter({
        path: 'messages.csv',
        header: [
            { id: 'name', title: 'Contact Name' },
            { id: 'number', title: 'Phone Number' },
            { id: 'lastMessage', title: 'Last Message' },
            { id: 'lastTalkedTo', title: 'Last Talked To' }
        ],
        append: true
    });

    csvWriter.writeRecords([messageData])
        .then(() => console.log('Message saved to CSV.'));
}

// Initialize WhatsApp client
client.initialize();
