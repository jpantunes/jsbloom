var JSBloom = {};

JSBloom.filter = function (items, target_prob) {

    if (typeof items !== "number" || typeof target_prob !== "number" || target_prob >= 1) {
        throw Error("Usage: new JSBloom.filter(items, target_probability)");
    };

    var BUFFER_LEN = (function () {
        var buffer = Math.ceil((items * Math.log(target_prob)) / Math.log(1.0 / (Math.pow(2.0, Math.log(2.0)))));

        if ((buffer % 8) !== 0) {
            buffer += 8 - (buffer % 8);
        };

        return buffer;
    })(),
        HASH_ROUNDS = Math.round(Math.log(2.0) * BUFFER_LEN / items),
        bVector = new Uint8Array(BUFFER_LEN / 8),

        hashes = {
            djb2: function (str) {
                var hash = 5381;

                for (var len = str.length, count = 0; count < len; count++) {
                    hash = hash * 33 ^ str.charCodeAt(count);
                };

                return (hash >>> 0) % BUFFER_LEN;
            },
            sdbm: function (str) {
                var hash = 0;

                for (var len = str.length, count = 0; count < len; count++) {
                    hash = str.charCodeAt(count) + (hash << 6) + (hash << 16) - hash;
                };

                return (hash >>> 0) % BUFFER_LEN;
            }
        },

        addEntry = function (str) {
            var h1 = hashes.djb2(str)
            var h2 = hashes.sdbm(str)
            var added = false
            for (var round = 0; round <= HASH_ROUNDS; round++) {
                var new_hash = round == 0 ? h1
                    : round == 1 ? h2
                        : (h1 + (round * h2) + (round ^ 2)) % BUFFER_LEN;

                var extra_indices = new_hash % 8,
                    index = ((new_hash - extra_indices) / 8);

                if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) == 0) {
                    bVector[index] ^= (128 >> extra_indices - 1);
                    added = true;
                } else if (extra_indices == 0 && (bVector[index] & 1) == 0) {
                    bVector[index] ^= 1;
                    added = true;
                }

            };

            return added;
        },

        addEntries = function (arr) {
            for (var i = arr.length - 1; i >= 0; i--) {
                addEntry(arr[i]);
            };

            return true;
        },

        checkEntry = function (str) {
            var index, extra_indices
            var h1 = hashes.djb2(str)

            extra_indices = h1 % 8;
            index = ((h1 - extra_indices) / 8);

            if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) == 0) {
                return false;
            } else if (extra_indices == 0 && (bVector[index] & 1) == 0) {
                return false;
            }

            var h2 = hashes.sdbm(str)
            extra_indices = h2 % 8;
            index = ((h2 - extra_indices) / 8);

            if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) == 0) {
                return false;
            } else if (extra_indices == 0 && (bVector[index] & 1) == 0) {
                return false;
            }

            for (var round = 2; round <= HASH_ROUNDS; round++) {
                var new_hash = round == 0 ? h1 : round == 1 ? h2 : (h1 + (round * h2) + (round ^ 2)) % BUFFER_LEN;
                var extra_indices = new_hash % 8,
                    index = ((new_hash - extra_indices) / 8);

                if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) == 0) {
                    return false;
                } else if (extra_indices == 0 && (bVector[index] & 1) == 0) {
                    return false;
                }
            };

            return true;
        },

        importData = function (data) {
            bVector = data
        },

        exportData = function () {
            return bVector
        };

    return {
        info: {
            type: "regular",
            buffer: BUFFER_LEN,
            hashes: HASH_ROUNDS,
            raw_buffer: bVector
        },
        hashes: hashes,
        addEntry: addEntry,
        addEntries: addEntries,
        checkEntry: checkEntry,
        importData: importData,
        exportData: exportData
    };
};

if (typeof exports !== "undefined") {
    exports.filter = JSBloom.filter;
};
