import { Database } from './db.js';

const fetchDiscoveryDocument = async (url) => {
    const response = await fetch(url);
    return await response.json();
};

// From: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#basic_example
const digest = async (value, algorithm = 'SHA-256') => {
    const data = new TextEncoder().encode(value);
    return await crypto.subtle.digest(algorithm, data);
};

const generateRandomString = (length = 128) => {
    var array = new Uint8Array(length / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map((num) => num.toString(16).padStart(2, '0'))
        .join('');
};

const generateCodeChallenge = async (codeVerifier) => {
    const hash = await digest(codeVerifier);
    const ascii = String.fromCharCode(...new Uint8Array(hash));
    const base64 = window.btoa(ascii);
    const urlEncoded = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return urlEncoded;
};

// See: https://datatracker.ietf.org/doc/html/rfc7636
const generateCodeVerifierAndChallenge = async () => {
    const codeVerifier = generateRandomString();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    return {
        codeVerifier,
        codeChallenge,
        codeChallengeMethod: 'S256'
    };
};

const objectToQueryString = (obj) => {
    return Object.entries(obj)
        .map((value) => `${value[0]}=${value[1]}`)
        .join('&');
};

const setupConfig = async (db, changeListener) => {
    const configSelectElement = document.querySelector('#config-select');
    const nameInputElement = document.querySelector('#name');
    const authenticationServerInputElement = document.querySelector('#auth-server');
    const audienceInputElement = document.querySelector('#audience');
    const clientIdInputElement = document.querySelector('#client-id');
    const clientSecretInputElement = document.querySelector('#client-secret');
    const scopeInputElement = document.querySelector('#scope');
    const saveButtonElement = document.querySelector('#save-config');
    const saveAsButtonElement = document.querySelector('#save-as-config');
    const removeButtonElement = document.querySelector('#remove-config');

    const requiredInputs = {
        name: nameInputElement.required,
        authenticationServer: authenticationServerInputElement.required,
        audience: audienceInputElement.required,
        clientId: clientIdInputElement.required,
        clientSecret: clientSecretInputElement.required,
        scope: scopeInputElement.required
    };

    const createDefaultConfig = () => {
        return {
            name: null,
            authenticationServer: authenticationServerInputElement.placeholder,
            audience: audienceInputElement.placeholder,
            clientId: clientIdInputElement.placeholder,
            clientSecret: clientSecretInputElement.placeholder,
            scope: scopeInputElement.placeholder
        };
    };

    const clearInputElements = () => {
        nameInputElement.value = null;
        authenticationServerInputElement.value = null;
        audienceInputElement.value = null;
        clientIdInputElement.value = null;
        clientSecretInputElement.value = null;
        scopeInputElement.value = null;
    };

    const updateInputElements = () => {
        nameInputElement.value = config.name;
        authenticationServerInputElement.value = config.authenticationServer;
        audienceInputElement.value = config.audience;
        clientIdInputElement.value = config.clientId;
        clientSecretInputElement.value = config.clientSecret;
        scopeInputElement.value = config.scope;
    };

    const updateButtons = () => {
        // Save/save as are only enabled if all required inputs are filled in
        let isDisabled = false;
        for (const key of Object.keys(requiredInputs)) {
            if (requiredInputs[key] && (!config[key] || config[key].length === 0)) {
                isDisabled = true;
                break;
            }
        }

        saveButtonElement.disabled = isDisabled;
        saveAsButtonElement.disabled = isDisabled;

        // Remove button is enabled if a config is selected
        removeButtonElement.disabled = !config.name;
    };

    const createOption = (item) => {
        const option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        return option;
    };

    const sortConfigurations = () => configurations.sort((a, b) => a.name.localeCompare(b.name));

    const addConfiguration = () => {
        configurations.push(config);
        sortConfigurations();

        const index = configurations.findIndex((elem) => elem.name === config.name);
        const child = configSelectElement.children[index + 1]; // +1 due to 'None' option
        const option = createOption(config);

        if (child) {
            configSelectElement.insertBefore(option, child);
        } else {
            configSelectElement.appendChild(option);
        }
    };

    const removeConfiguration = async () => {
        await db.removeItem(persisted.name);
        const index = configurations.findIndex((elem) => elem.name === persisted.name);
        const child = configSelectElement.children[index + 1]; // +1 due to 'None' option
        configurations = configurations.filter((elem) => elem.name !== persisted.name);
        configSelectElement.removeChild(child);
    };

    const selectConfiguration = (name) => {
        if (name) {
            configSelectElement.value = name;
            localStorage.setItem('config', name);
        } else {
            configSelectElement.value = '';
            localStorage.removeItem('config');
        }

        if (name) {
            config = { ...configurations.find((elem) => elem.name === name) };
            updateInputElements();
        } else {
            config = createDefaultConfig();
            clearInputElements();
        }
        updateButtons();
        persisted = { ...config };
        changeListener(readonlyConfig);
    };

    configSelectElement.addEventListener('change', (event) => {
        const name = event.target.value;
        selectConfiguration(name);
    });

    const addChangeListener = (element, propertyName) => {
        element.addEventListener('input', (event) => {
            const value = event.target.value;
            config[propertyName] = value;
            updateButtons();
            changeListener(readonlyConfig);
        });
    };

    addChangeListener(nameInputElement, 'name');
    addChangeListener(authenticationServerInputElement, 'authenticationServer');
    addChangeListener(audienceInputElement, 'audience');
    addChangeListener(clientIdInputElement, 'clientId');
    addChangeListener(clientSecretInputElement, 'clientSecret');
    addChangeListener(scopeInputElement, 'scope');

    saveButtonElement.addEventListener('click', async () => {
        await db.setItem(config.name, config);

        if (persisted.name && persisted.name !== config.name) {
            await removeConfiguration();
        }

        const isNewConfig = configurations.every((elem) => elem.name !== config.name);
        if (isNewConfig) {
            addConfiguration();
        }
        selectConfiguration(config.name);
    });

    saveAsButtonElement.addEventListener('click', async () => {
        const isDuplicateName = configurations.some((elem) => elem.name === config.name);

        if (isDuplicateName) {
            config.name = `Copy of ${config.name}`;
        }

        await db.setItem(config.name, config);
        addConfiguration();
        selectConfiguration(config.name);
    });

    removeButtonElement.addEventListener('click', async () => {
        await removeConfiguration();
        selectConfiguration(null);
    });

    let configurations = await db.getItems();
    sortConfigurations();

    configurations.forEach((config) => {
        const option = createOption(config);
        configSelectElement.append(option);
    });

    let config = createDefaultConfig();
    let persisted = { ...config };
    updateButtons();

    const readonlyConfig = {
        get name() {
            return config.name;
        },
        get authenticationServer() {
            return config.authenticationServer;
        },
        get audience() {
            return config.audience;
        },
        get clientId() {
            return config.clientId;
        },
        get clientSecret() {
            return config.clientSecret;
        },
        get scope() {
            return config.scope;
        }
    };

    const initialConfigName = localStorage.getItem('config');
    if (initialConfigName) {
        selectConfiguration(initialConfigName);
    }

    return readonlyConfig;
};

const buildUrl = (origin, path) => {
    const url = new URL(origin);
    return `${url.origin}${path}`;
};

const storeAuthorizeQuery = (query) => {
    localStorage.setItem('authorize', JSON.stringify(query, null, 2));
};

const retrieveAuthorizeQuery = () => {
    const query = localStorage.getItem('authorize');
    if (query) {
        return JSON.parse(query);
    }
    return null;
};

const main = async () => {
    const configPreElement = document.querySelector('#config');
    const authorizeAnchorElement = document.querySelector('#authorize');
    const authorizeResponsePreElement = document.querySelector('#authorize-response');
    const tokenResponsePreElement = document.querySelector('#token-response');
    const copyAuthorizationHeaderButtonElement = document.querySelector('#copy-authorization-header');
    const copyAccessTokenButtonElement = document.querySelector('#copy-access-token');
    const refreshTokenButtonElement = document.querySelector('#refresh-token');

    const db = await Database.build();

    await setupConfig(db, async (config) => {
        const discoveryDocumentUrl = buildUrl(config.authenticationServer, '/.well-known/openid-configuration');
        const discoveryDocument = await fetchDiscoveryDocument(discoveryDocumentUrl);
        configPreElement.textContent = JSON.stringify(discoveryDocument, null, 2);

        const { codeVerifier, codeChallenge, codeChallengeMethod } = await generateCodeVerifierAndChallenge();

        const query = {
            response_type: 'code',
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
            client_id: config.clientId,
            redirect_uri: window.location.href,
            scope: config.scope,
            audience: config.audience,
            state: 'jkl'
        };

        const queryString = objectToQueryString(query);

        const authorizeUrl = encodeURI(`${discoveryDocument['authorization_endpoint']}?${queryString}`);
        authorizeAnchorElement.href = authorizeUrl;
        authorizeAnchorElement.addEventListener('click', () =>
            storeAuthorizeQuery({
                ...query,
                code_verifier: codeVerifier,
                discovery_document: discoveryDocument
            })
        );
    });

    if (window.location.search) {
        const result = Object.fromEntries(
            window.location.search
                .slice(1)
                .split('&')
                .map((value) => value.split('='))
        );
        authorizeResponsePreElement.textContent = JSON.stringify(result, null, 2);

        const query = retrieveAuthorizeQuery();

        if (result.code && result.state === query.state) {
            tokenResponsePreElement.textContent = 'Fetching token...';

            const data = {
                grant_type: 'authorization_code',
                client_id: query.client_id,
                code_verifier: query.code_verifier,
                code: result.code,
                redirect_uri: query.redirect_uri
            };

            const formData = encodeURI(objectToQueryString(data));
            try {
                const tokenResponse = await fetch(query.discovery_document.token_endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                });
                let data = await tokenResponse.json();
                tokenResponsePreElement.textContent = JSON.stringify(data, null, 2);
                window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);

                if (tokenResponse.status !== 200) {
                    return;
                }

                copyAuthorizationHeaderButtonElement.addEventListener('click', () => {
                    navigator.clipboard.writeText(`"Authorization": "Bearer ${data.access_token}"`);
                });

                copyAccessTokenButtonElement.addEventListener('click', () => {
                    navigator.clipboard.writeText(data.access_token);
                });

                copyAuthorizationHeaderButtonElement.disabled = false;
                copyAccessTokenButtonElement.disabled = false;

                refreshTokenButtonElement.addEventListener('click', async () => {
                    copyAuthorizationHeaderButtonElement.disabled = true;
                    copyAccessTokenButtonElement.disabled = true;
                    refreshTokenButtonElement.disabled = true;

                    const refreshTokenData = {
                        grant_type: 'refresh_token',
                        client_id: config.clientId,
                        refresh_token: data.refresh_token
                    };

                    const refreshTokenFormData = Object.entries(refreshTokenData)
                        .map((value) => `${value[0]}=${encodeURIComponent(value[1])}`)
                        .join('&');

                    const refreshTokenResponse = await fetch(discoveryDocument['token_endpoint'], {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded'
                        },
                        body: refreshTokenFormData
                    });

                    data = await refreshTokenResponse.json();
                    tokenResponsePreElement.textContent = JSON.stringify(data, null, 2);

                    if (tokenResponse.status !== 200) {
                        return;
                    }

                    copyAuthorizationHeaderButtonElement.disabled = false;
                    refreshTokenButtonElement.disabled = false;
                    copyAccessTokenButtonElement.disabled = false;
                });

                refreshTokenButtonElement.disabled = false;
            } catch (e) {
                tokenResponsePreElement.textContent = 'Failed to fetch token';
            }
        }
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    await main();
});
