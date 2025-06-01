// packages/shared/src/utils/config/tradeprofx-config.js
export const TRADEPROFX_APP_ID = 80074;
export const TRADEPROFX_DOMAIN = 'tradeprofxapp.pages.dev';
export const TRADEPROFX_BRAND = 'tradeprofx';

export const isTradeProfxDomain = () => {
    return window.location.hostname === TRADEPROFX_DOMAIN;
};

export const getTradeProfxAppId = () => {
    if (isTradeProfxDomain()) {
        return TRADEPROFX_APP_ID;
    }
    return null;
};
