import { api_base } from '../api/api-base';
import { observer as globalObserver } from '../../utils/observer';

class Balance {
    constructor() {
        this.balance = 0;
        this.currency = '';
        this.is_loading = false;
        this.last_update = null;
    }

    async init() {
        try {
            console.log('Balance: Initializing balance service');
            await this.updateBalance();
            this.subscribeToBalance();
        } catch (error) {
            console.error('Balance: Failed to initialize:', error);
        }
    }

    async updateBalance(force = false) {
        if (this.is_loading && !force) {
            console.log('Balance: Update already in progress');
            return this.balance;
        }

        this.is_loading = true;
        
        try {
            console.log('Balance: Requesting balance update...');
            
            // Use the API base to get balance
            const balance_response = await api_base.getBalance();
            
            if (balance_response) {
                this.balance = parseFloat(balance_response.balance) || 0;
                this.currency = balance_response.currency || '';
                this.last_update = Date.now();
                
                console.log('Balance: Updated successfully:', {
                    balance: this.balance,
                    currency: this.currency,
                    timestamp: new Date(this.last_update).toISOString()
                });

                // Emit balance update event
                globalObserver.emit('balance.update', {
                    balance: this.balance,
                    currency: this.currency
                });
            } else {
                console.warn('Balance: No balance data received');
            }
        } catch (error) {
            console.error('Balance: Failed to update balance:', error);
        } finally {
            this.is_loading = false;
        }

        return this.balance;
    }

    subscribeToBalance() {
        if (!api_base.api) {
            console.warn('Balance: API not available for subscription');
            return;
        }

        try {
            // Subscribe to balance updates
            const subscription = api_base.api.onMessage().subscribe(response => {
                if (response.msg_type === 'balance') {
                    console.log('Balance: Received balance update:', response.balance);
                    
                    this.balance = parseFloat(response.balance.balance) || 0;
                    this.currency = response.balance.currency || '';
                    this.last_update = Date.now();

                    // Emit balance update event
                    globalObserver.emit('balance.update', {
                        balance: this.balance,
                        currency: this.currency
                    });
                }
            });

            api_base.pushSubscription(subscription);
            console.log('Balance: Subscribed to balance updates');
        } catch (error) {
            console.error('Balance: Failed to subscribe to balance updates:', error);
        }
    }

    getBalance() {
        console.log('Balance: Current balance requested:', {
            balance: this.balance,
            currency: this.currency,
            last_update: this.last_update ? new Date(this.last_update).toISOString() : 'Never'
        });
        
        return {
            balance: this.balance,
            currency: this.currency,
            display: `${this.balance.toFixed(2)} ${this.currency}`
        };
    }

    hasEnoughBalance(amount) {
        const required = parseFloat(amount) || 0;
        const available = this.balance;
        
        console.log('Balance: Checking sufficient funds:', {
            required: required,
            available: available,
            sufficient: available >= required
        });
        
        return available >= required;
    }

    async forceUpdate() {
        console.log('Balance: Force updating balance...');
        return await this.updateBalance(true);
    }

    reset() {
        this.balance = 0;
        this.currency = '';
        this.last_update = null;
        console.log('Balance: Reset to default values');
    }
}

// Create singleton instance
export const balance_service = new Balance();
export default balance_service;
