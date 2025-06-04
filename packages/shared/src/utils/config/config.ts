import { isBot } from '../platform';
import { isStaging } from '../url/helpers';

export const livechat_license_id = 12049137;
export const livechat_client_id = '66aa088aad5a414484c1fd1fa8a5ace7';

export const domain_app_ids = {
    'deriv.app': 80074,
    'app.deriv.com': 80074,
    'staging-app.deriv.com': 80074,
    'app.deriv.me': 80074,
    'staging-app.deriv.me': 80074,
    'app.deriv.be': 80074,
    'staging-app.deriv.be': 80074,
    'binary.com': 80074,
    'test-app.deriv.com': 80074,
};

export const platform_app_ids = {
    derivgo: 80074,
};

export const getCurrentProductionDomain = () =>
    !/^staging\./.test(window.location.hostname) &&
    Object.keys(domain_app_ids).find(domain => window.location.hostname === domain);

export const isProduction = () => {
    const all_domains = Object.keys(domain_app_ids).map(domain => `(www\\.)?${domain.replace('.', '\\.')}`);
    return new RegExp(`^(${all_domains.join('|')})$`, 'i').test(window.location.hostname);
};

export const isTestLink = () => {
    return /^((.*)\.binary\.sx)$/i.test(window.location.hostname);
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

/**
 * Always returns your custom App ID (80074)
 */
export const getAppId = () => {
    const user_app_id = '80074';
    window.localStorage.setItem('config.default_app_id', user_app_id);
    return user_app_id;
};

/**
 * Always returns your custom WebSocket URL (https://tradeprofxapp.pages.dev/)
 */
export const getSocketURL = () => {
    return 'https://tradeprofxapp.pages.dev/';
};

export const checkAndSetEndpointFromUrl = () => {
    if (isTestLink()) {
        const url_params = new URLSearchParams(location.search.slice(1));

        if (url_params.has('qa_server') && url_params.has('app_id')) {
            const qa_server = url_params.get('qa_server') || '';
            const app_id = url_params.get('app_id') || '';

            url_params.delete('qa_server');
            url_params.delete('app_id');

            if (/^(^(www\.)?qa[0-9]{1,4}\.deriv.dev|(.*)\.derivws\.com)$/.test(qa_server) && /^[0-9]+$/.test(app_id)) {
                localStorage.setItem('config.app_id', app_id);
                localStorage.setItem('config.server_url', qa_server);
            }

            const params = url_params.toString();
            const hash = location.hash;

            location.href = `${location.protocol}//${location.hostname}${location.pathname}${
                params ? `?${params}` : ''
            }${hash || ''}`;

            return true;
        }
    }

    return false;
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);
    return false;
};
