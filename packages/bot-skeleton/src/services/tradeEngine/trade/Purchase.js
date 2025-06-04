import { getFormattedText } from '@deriv/shared';
import { info } from '../utils/broadcast';
import DBotStore from '../../../scratch/dbot-store';
import { api_base } from '../../api/api-base';
import { balance_service } from './Balance';

export default Engine =>
    class Purchase extends Engine {
        constructor() {
            super();
            this.purchase_reference = null;
            this.is_purchasing = false;
        }

        async purchase(contract_type, options = {}) {
            if (this.is_purchasing) {
                console.log('Bot: Purchase already in progress, skipping...');
                return Promise.reject(new Error('Purchase already in progress'));
            }

            this.is_purchasing = true;

            try {
                console.log('Bot: Starting purchase process...', { contract_type, options });

                // Force update balance before purchase
                await balance_service.forceUpdate();
                const current_balance = balance_service.getBalance();
                
                console.log('Bot: Purchase - Current balance:', current_balance);

                // Validate purchase amount
                const stake = parseFloat(options.amount || options.stake || 1);
                
                if (!balance_service.hasEnoughBalance(stake)) {
                    const error_msg = `Insufficient balance. Required: ${stake} ${current_balance.currency}, Available: ${current_balance.balance} ${current_balance.currency}`;
                    console.error('Bot: Purchase failed -', error_msg);
                    
                    info({
                        accountID: this.accountInfo?.loginid,
                        balance: current_balance.display,
                        error: error_msg
                    });
                    
                    throw new Error(error_msg);
                }

                console.log('Bot: Balance check passed, proceeding with purchase');

                // Prepare purchase request
                const purchase_request = {
                    buy: 1,
                    price: stake,
                    parameters: {
                        contract_type: contract_type,
                        ...options
                    }
                };

                console.log('Bot: Sending purchase request:', purchase_request);

                // Send purchase request
                const response = await api_base.send(purchase_request);

                if (response.error) {
                    console.error('Bot: Purchase failed with error:', response.error);
                    throw new Error(response.error.message || 'Purchase failed');
                }

                console.log('Bot: Purchase successful:', response.buy);

                // Store purchase reference
                this.purchase_reference = response.buy.contract_id;

                // Update balance after purchase
                setTimeout(() => {
                    balance_service.forceUpdate();
                }, 1000);

                // Broadcast success
                info({
                    accountID: this.accountInfo?.loginid,
                    balance: current_balance.display,
                    purchase: {
                        contract_id: response.buy.contract_id,
                        buy_price: response.buy.buy_price,
                        payout: response.buy.payout
                    }
                });

                return response.buy;

            } catch (error) {
                console.error('Bot: Purchase error:', error);
                
                // Broadcast error
                info({
                    accountID: this.accountInfo?.loginid,
                    error: error.message || 'Purchase failed'
                });

                throw error;
            } finally {
                this.is_purchasing = false;
            }
        }

        // Legacy method for backward compatibility
        purchaseContract(contract_type, options) {
            return this.purchase(contract_type, options);
        }

        // Get current purchase reference
        getPurchaseReference() {
            return this.purchase_reference;
        }

        // Check if purchase is in progress
        isPurchasing() {
            return this.is_purchasing;
        }

        // Reset purchase state
        resetPurchase() {
            this.purchase_reference = null;
            this.is_purchasing = false;
            console.log('Bot: Purchase state reset');
        }

        // Get balance (legacy method)
        getBalance(type) {
            const balance_data = balance_service.getBalance();
            
            if (type === 'STR') {
                return balance_data.display;
            }
            
            return balance_data.balance;
        }

        // Observe balance changes (legacy method)
        observeBalance() {
            // Balance observation is now handled by balance_service
            console.log('Bot: Balance observation delegated to balance_service');
        }
    };
