import { getAppId, getSocketURL } from '@deriv/shared';
import { generateDerivApiInstance, getLoginId, getToken } from '@deriv/bot-skeleton/src/utils';

class APIBase {
    constructor() {
        this.api = null;
        this.token = getToken();
        this.account_id = getLoginId();
        this.is_connected = false;
        this.connection_manager = null;
        this.subscribers = new Map();
        
        // Use YOUR registered App ID for tradeprofxapp.pages.dev
        this.app_id = 80074; // Your registered App ID
        
        console.log('Bot API: Initializing with App ID:', this.app_id);
    }

    async init() {
        if (this.api) {
            return this.api;
        }

        try {
            // Use your domain's configuration
            const server_url = getSocketURL();
            
            console.log('Bot API: Connecting to server:', server_url);
            console.log('Bot API: Using App ID:', this.app_id);
            console.log('Bot API: Domain:', window.location.hostname);
            
            this.api = await generateDerivApiInstance({
                app_id: this.app_id,
                server_url: server_url,
                lang: 'EN'
            });

            this.setupConnectionHandlers();
            
            if (this.token) {
                await this.authorize();
            }

            return this.api;
        } catch (error) {
            console.error('Bot API: Failed to initialize:', error);
            throw error;
        }
    }

    setupConnectionHandlers() {
        if (!this.api) return;

        this.api.onOpen = () => {
            console.log('Bot API: WebSocket connection opened');
            this.is_connected = true;
        };

        this.api.onClose = () => {
            console.log('Bot API: WebSocket connection closed');
            this.is_connected = false;
        };

        this.api.onMessage = (response) => {
            this.handleResponse(response);
        };
    }

    async authorize() {
        if (!this.api || !this.token) {
            console.log('Bot API: Cannot authorize - missing API or token');
            return null;
        }

        try {
            console.log('Bot API: Authorizing with token...');
            const response = await this.api.authorize(this.token);
            
            if (response.error) {
                console.error('Bot API: Authorization failed:', response.error);
                return null;
            }

            console.log('Bot API: Authorization successful:', response.authorize);
            this.account_id = response.authorize.loginid;
            
            return response;
        } catch (error) {
            console.error('Bot API: Authorization error:', error);
            return null;
        }
    }

    handleResponse(response) {
        const { msg_type, req_id } = response;
        
        // Handle balance updates
        if (msg_type === 'balance') {
            console.log('Bot API: Balance update received:', response.balance);
        }
        
        // Handle authorization
        if (msg_type === 'authorize') {
            if (response.error) {
                console.error('Bot API: Auth error:', response.error);
            } else {
                console.log('Bot API: Auth success:', response.authorize);
            }
        }

        // Notify subscribers
        if (this.subscribers.has(req_id)) {
            const callback = this.subscribers.get(req_id);
            callback(response);
            this.subscribers.delete(req_id);
        }
    }

    async send(request) {
        if (!this.api) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const req_id = this.api.send(request);
            
            this.subscribers.set(req_id, (response) => {
                if (response.error) {
                    reject(response.error);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async getBalance() {
        try {
            const response = await this.send({ balance: 1 });
            console.log('Bot API: Balance response:', response);
            return response.balance;
        } catch (error) {
            console.error('Bot API: Failed to get balance:', error);
            return null;
        }
    }

    disconnect() {
        if (this.api) {
            this.api.disconnect();
            this.api = null;
            this.is_connected = false;
        }
    }
}

export default APIBase;
