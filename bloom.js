'use strict';

class JSBloom {
    constructor(items, target_prob) {
        if (typeof items !== "number"
            || typeof target_prob !== "number"
            || target_prob >= 1)
        {
            throw Error("Usage: new JSBloom(items, target_probability)");
        }

        this.BUFFER_LEN = JSBloom.getBufferLen(items, target_prob);
        this.HASH_ROUNDS = Math.round(Math.log(2.0) * this.BUFFER_LEN / items);
        this.bVector = new Uint8Array(this.BUFFER_LEN / 8);

        this.hashes = {
            djb2: str => {
                let hash = 5381;

                [...str].forEach( (_, idx) => hash = hash * 33 ^ str.charCodeAt(idx));

                return (hash >>> 0) % this.BUFFER_LEN;
            },
            sdbm: str => {
                let hash = 0;

                [...str].forEach( (_, idx) => hash = str.charCodeAt(idx) + (hash << 6) + (hash << 16) - hash);

                return (hash >>> 0) % this.BUFFER_LEN;
            }
        };

        return {
            info: {
                type: "regular",
                buffer: this.BUFFER_LEN,
                hashes: this.HASH_ROUNDS,
                raw_buffer: this.bVector
            },
            hashingMethods: this.hashes,
            addEntry: this.addEntry,
            addEntries: this.addEntries,
            checkEntry: this.checkEntry,
            importData: this.importData,
            exportData: this.exportData
        };
    };

    static getBufferLen(items, target_prob) {
        let bufferLen = Math.ceil((items * Math.log(target_prob)) / Math.log(1.0 / (Math.pow(2.0, Math.log(2.0)))));
        if ((bufferLen % 8) !== 0) {
            bufferLen += 8 - (bufferLen % 8);
        }
        return bufferLen;
    }

    addEntry = str => {
        if (typeof str !== 'string' ) {
            throw Error("Error: function expects input of type string");
        }

        const h1 = this.hashes.djb2(str);
        const h2 = this.hashes.sdbm(str);
        let added = false;

        for (let round = 0; round <= this.HASH_ROUNDS; round++) {
            const new_hash = round === 0 ? h1
                : round === 1 ? h2
                : (h1 + (round * h2) + (round ^ 2)) % this.BUFFER_LEN;

            const extra_indices = new_hash % 8;
            const index = ((new_hash - extra_indices) / 8);

            if (extra_indices != 0 && (this.bVector[index] & (128 >> (extra_indices - 1))) === 0) {
                this.bVector[index] ^= (128 >> extra_indices - 1);
                added = true;
            } else if (extra_indices === 0 && (this.bVector[index] & 1) === 0) {
                this.bVector[index] ^= 1;
                added = true;
            }

        };

        return added;
    };

    addEntries = arr => {
        if (!Array.isArray(arr)) {
            throw Error("Usage: <obj>.addEntries([val1, val2, ...rest])");
        }

        arr.forEach( (_, idx, theArr) => this.addEntry(theArr[theArr.length - 1 - idx ]) );

        return true;
    };

    checkEntry = str => {
        if (typeof str !== 'string' ) {
            throw Error("Error: function expects input of type string");
        }

        const h1 = this.hashes.djb2(str);
        let extra_indices = h1 % 8;
        let index = ((h1 - extra_indices) / 8);

        if (extra_indices != 0 && (this.bVector[index] & (128 >> (extra_indices - 1))) === 0) {
            return false;
        } else if (extra_indices === 0 && (this.bVector[index] & 1) === 0) {
            return false;
        }

        const h2 = this.hashes.sdbm(str);
        extra_indices = h2 % 8;
        index = ((h2 - extra_indices) / 8);

        if (extra_indices != 0 && (this.bVector[index] & (128 >> (extra_indices - 1))) === 0) {
            return false;
        } else if (extra_indices === 0 && (this.bVector[index] & 1) === 0) {
            return false;
        }

        for (let round = 2; round <= this.HASH_ROUNDS; round++) {
            const new_hash = round === 0 ? h1
                : round === 1 ? h2
                : (h1 + (round * h2) + (round ^ 2)) % this.BUFFER_LEN;
            const extra_indices = new_hash % 8;
            const index = ((new_hash - extra_indices) / 8);

            if (extra_indices != 0 && (this.bVector[index] & (128 >> (extra_indices - 1))) === 0) {
                return false;
            } else if (extra_indices === 0 && (this.bVector[index] & 1) === 0) {
                return false;
            }
        }

        return true;
    };

    importData = data => this.bVector = data;

    exportData = () => this.bVector;
}

module.exports = JSBloom;