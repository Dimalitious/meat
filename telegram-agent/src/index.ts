import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import * as fs from 'fs';
import * as path from 'path';
import * as input from 'input';
import { config, validateConfig } from './config';
import { api, TelegramGroup } from './api';
import { parseOrder, looksLikeOrder, initFuzzySearch } from './parser';

class TelegramAgent {
    private client: TelegramClient | null = null;
    private groups: Map<string, TelegramGroup> = new Map();
    private isRunning: boolean = false;

    /**
     * Initialize and start the agent
     */
    async start(): Promise<void> {
        console.log('🚀 Starting Telegram Agent...\n');

        // Validate configuration
        if (!validateConfig()) {
            process.exit(1);
        }

        // Check server connection
        console.log('🔌 Checking server connection...');
        const serverOk = await api.healthCheck();
        if (!serverOk) {
            console.error('❌ Cannot connect to meatpr server at', config.server.url);
            console.error('   Make sure the server is running');
            process.exit(1);
        }
        console.log('✅ Server connection OK\n');

        // Load products for fuzzy matching
        console.log('📦 Loading products for fuzzy matching...');
        const products = await api.getProducts();
        if (products.length > 0) {
            initFuzzySearch(products);
        } else {
            console.warn('⚠️ No products loaded - fuzzy matching disabled');
        }

        // Load session
        const sessionPath = path.resolve(config.telegram.sessionPath);
        let sessionString = '';
        if (fs.existsSync(sessionPath)) {
            sessionString = fs.readFileSync(sessionPath, 'utf-8');
            console.log('📂 Session loaded from file');
        }

        // Create client
        const session = new StringSession(sessionString);
        this.client = new TelegramClient(
            session,
            config.telegram.apiId,
            config.telegram.apiHash,
            {
                connectionRetries: 5,
            }
        );

        // Connect and authorize
        console.log('\n🔐 Connecting to Telegram...');
        await this.client.start({
            phoneNumber: async () => config.telegram.phone,
            password: async () => {
                return await input.text('Enter 2FA password (if enabled): ');
            },
            phoneCode: async () => {
                return await input.text('Enter the code you received: ');
            },
            onError: (err) => console.error('Auth error:', err),
        });

        // Save session
        const newSession = this.client.session.save() as unknown as string;
        const sessionDir = path.dirname(sessionPath);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        fs.writeFileSync(sessionPath, newSession);
        console.log('✅ Connected and session saved!\n');

        // Load groups
        await this.loadGroups();

        // Set up message handler
        this.client.addEventHandler(
            this.handleNewMessage.bind(this),
            new NewMessage({})
        );

        this.isRunning = true;
        console.log('👂 Listening for new messages...');
        console.log('   Press Ctrl+C to stop\n');

        // Keep running
        await this.client.run();
    }

    /**
     * Load active groups from server
     */
    async loadGroups(): Promise<void> {
        console.log('📋 Loading monitored groups...');
        const groups = await api.getActiveGroups();

        this.groups.clear();
        for (const group of groups) {
            this.groups.set(group.chatId, group);
        }

        console.log(`   Found ${this.groups.size} active group(s)`);
        for (const group of groups) {
            console.log(`   - ${group.title} (${group.chatId})`);
        }
        console.log('');
    }

    /**
     * Handle incoming messages
     */
    private async handleNewMessage(event: NewMessageEvent): Promise<void> {
        const message = event.message;

        // Get chat ID
        const chatId = message.chatId?.toString();
        if (!chatId) return;

        // Check if this chat is being monitored
        const group = this.groups.get(chatId);
        if (!group || !group.isActive) return;

        // Get message text
        const text = message.text;
        if (!text || text.length < 10) return; // Skip short messages

        // Quick check if it looks like an order
        if (!looksLikeOrder(text)) return;

        console.log(`\n📨 New message in "${group.title}":`);
        console.log(`   ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

        // Parse the message
        const parsed = parseOrder(text, group);

        if (!parsed.isOrder) {
            console.log('   ⏭️ Not recognized as an order');
            return;
        }

        console.log(`   ✅ Parsed ${parsed.items.length} item(s)`);
        for (const item of parsed.items) {
            const match = item.matchedProducts?.[0];
            const matchInfo = match ? ` → ${match.name} (${match.score}%)` : '';
            console.log(`      - ${item.rawProductName} ${item.rawQuantity}${matchInfo}`);
        }

        // Get sender info
        let senderName: string | null = null;
        let senderId: string | null = null;
        try {
            const sender = await message.getSender();
            if (sender && 'firstName' in sender) {
                senderName = [sender.firstName, sender.lastName].filter(Boolean).join(' ');
                senderId = sender.id?.toString() || null;
            }
        } catch (e) {
            // Ignore sender fetch errors
        }

        // Send to server
        const created = await api.createDraft({
            groupId: group.id,
            messageId: message.id.toString(),
            messageText: text,
            messageDate: new Date(message.date * 1000).toISOString(),
            senderName,
            senderId,
            parsedOrderNumber: parsed.orderNumber,
            parsedCustomer: parsed.customer,
            parsedAddress: parsed.address,
            items: parsed.items.map(item => ({
                rawProductName: item.rawProductName,
                rawQuantity: item.rawQuantity,
                rawPrice: item.rawPrice,
            })),
        });

        if (created) {
            // Update last message ID
            await api.updateLastMessageId(group.id, message.id);
        }
    }

    /**
     * Stop the agent
     */
    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.client) {
            await this.client.disconnect();
        }
        console.log('\n👋 Agent stopped');
    }
}

// Main entry point
const agent = new TelegramAgent();

// Handle shutdown
process.on('SIGINT', async () => {
    await agent.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await agent.stop();
    process.exit(0);
});

// Start
agent.start().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
