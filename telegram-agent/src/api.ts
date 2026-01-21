import axios, { AxiosInstance } from 'axios';
import { config } from './config';

export interface TelegramGroup {
    id: number;
    chatId: string;
    title: string;
    username: string | null;
    isActive: boolean;
    lastMessageId: number | null;
    parsePatterns: Record<string, string> | null;
}

export interface CreateDraftPayload {
    groupId: number;
    messageId: string;
    messageText: string;
    messageDate: string;
    senderName: string | null;
    senderId: string | null;
    parsedOrderNumber: string | null;
    parsedCustomer: string | null;
    parsedAddress: string | null;
    items: {
        rawProductName: string;
        rawQuantity: string;
        rawPrice: string | null;
    }[];
}

export interface ProductMatch {
    id: number;
    code: string;
    name: string;
    altName: string | null;
    score: number;
}

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: config.server.url,
            headers: {
                'Content-Type': 'application/json',
                ...(config.server.apiKey && { 'X-API-Key': config.server.apiKey }),
            },
            timeout: 10000,
        });
    }

    /**
     * Get all active groups for monitoring
     */
    async getActiveGroups(): Promise<TelegramGroup[]> {
        try {
            const response = await this.client.get('/api/telegram/groups', {
                params: { isActive: true }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Failed to fetch groups:', error);
            return [];
        }
    }

    /**
     * Create a new order draft from parsed message
     */
    async createDraft(payload: CreateDraftPayload): Promise<boolean> {
        try {
            await this.client.post('/api/telegram/drafts', payload);
            console.log(`✅ Draft created for message ${payload.messageId}`);
            return true;
        } catch (error: any) {
            if (error.response?.status === 409) {
                // Duplicate - already processed
                console.log(`⏭️ Message ${payload.messageId} already processed`);
                return false;
            }
            console.error('❌ Failed to create draft:', error.message);
            return false;
        }
    }

    /**
     * Update last processed message ID for a group
     */
    async updateLastMessageId(groupId: number, messageId: number): Promise<void> {
        try {
            await this.client.patch(`/api/telegram/groups/${groupId}`, {
                lastMessageId: messageId
            });
        } catch (error) {
            console.error('❌ Failed to update lastMessageId:', error);
        }
    }

    /**
     * Get products for fuzzy matching
     */
    async getProducts(): Promise<ProductMatch[]> {
        try {
            const response = await this.client.get('/api/products', {
                params: { status: 'active' }
            });
            return response.data.map((p: any) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                altName: p.altName,
                score: 0
            }));
        } catch (error) {
            console.error('❌ Failed to fetch products:', error);
            return [];
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.client.get('/api/health');
            return true;
        } catch (error) {
            return false;
        }
    }
}

export const api = new ApiClient();
