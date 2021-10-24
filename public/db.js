class Database {
    constructor() {
        this._name = 'auth-tool';
        this._version = 1;
        /** @type {IDBDatabase} */
        this._indexedDb = null;
        this._storeName = 'configurations';
    }

    /** @param {IDBVersionChangeEvent} event */
    _upgrade(event, reject) {
        const db = event.target.result;
        const configurationsStore = db.createObjectStore(this._storeName);
        configurationsStore.transaction.addEventListener('error', () => reject(new Error('Database upgrade failed!')));
        configurationsStore.transaction.oncomplete = () => console.log(`Upgraded database to version ${db.version}`);
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this._name, this._version);
            request.addEventListener('error', (event) => reject(event.target.errorCode));
            request.addEventListener('upgradeneeded', (event) => this._upgrade(event, reject));
            request.addEventListener('success', (event) => {
                this._indexedDb = event.target.result;
                resolve(this);
            });
        });
    }

    async setItem(key, value) {
        if (!this._indexedDb) throw Error('Database must be opened before querying');
        return new Promise((resolve, reject) => {
            const request = this._indexedDb
                .transaction(this._storeName, 'readwrite')
                .objectStore(this._storeName)
                .put(value, key);
            request.addEventListener('error', (event) => reject(event.target.errorCode));
            request.addEventListener('success', (event) => {
                resolve(event.target.result);
            });
        });
    }

    async getItem(key) {
        if (!this._indexedDb) throw Error('Database must be opened before querying');
        return new Promise((resolve, reject) => {
            const request = this._indexedDb
                .transaction(this._storeName, 'readonly')
                .objectStore(this._storeName)
                .get(key);
            request.addEventListener('error', (event) => reject(event.target.errorCode));
            request.addEventListener('success', (event) => {
                resolve(event.target.result);
            });
        });
    }

    async getItems() {
        if (!this._indexedDb) throw Error('Database must be opened before querying');
        return new Promise((resolve, reject) => {
            const request = this._indexedDb
                .transaction(this._storeName, 'readonly')
                .objectStore(this._storeName)
                .getAll();
            request.addEventListener('error', (event) => reject(event.target.errorCode));
            request.addEventListener('success', (event) => {
                resolve(event.target.result);
            });
        });
    }

    async removeItem(key) {
        if (!this._indexedDb) throw Error('Database must be opened before querying');
        return new Promise((resolve, reject) => {
            const request = this._indexedDb
                .transaction(this._storeName, 'readwrite')
                .objectStore(this._storeName)
                .delete(key);
            request.addEventListener('error', (event) => reject(event.target.errorCode));
            request.addEventListener('success', (event) => {
                resolve(event.target.result);
            });
        });
    }

    static async build() {
        return await new Database().open();
    }
}

export { Database };
