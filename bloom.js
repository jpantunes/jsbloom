'use strict';
const LZString = require('./lz-string')();

const getBufferLenFor = (items, target_prob) => {
  let bufferLen = Math.ceil(
                      (items * Math.log(target_prob)) /
                      Math.log(1.0 / (Math.pow(2.0, Math.log(2.0)))));
  return ((bufferLen % 8) !== 0) ? bufferLen += 8 - (bufferLen % 8) : bufferLen
}

const JSBloom = (items, target_prob) => {
  if (typeof items !== "number"
                  || typeof target_prob !== "number"
                  || target_prob >= 1)
  {
      throw Error("Usage: JSBloom(items, target_probability)");
  }

  //must be mutable to allow import data.. review
  let BUFFER_LEN = getBufferLenFor(items, target_prob);
  let HASH_ROUNDS = Math.round(Math.log(2.0) * BUFFER_LEN / items);
  let bVector = new Uint8Array(BUFFER_LEN / 8);

  const hashes = {
    djb2: str => {
      let hash = 5381;
      [...str].forEach( (_, idx) => hash = hash * 33 ^ str.charCodeAt(idx));
      return (hash >>> 0) % BUFFER_LEN;
    },
    sdbm: str => {
      let hash = 0;
      [...str].forEach( (_, idx) => hash = str.charCodeAt(idx) + (hash << 6) + (hash << 16) - hash);
      return (hash >>> 0) % BUFFER_LEN;
    }
  };

  const addEntry = str => {
    if (typeof str !== 'string' ) {
        throw Error("Error: function expects input of type string");
    }

    const h1 = hashes.djb2(str);
    const h2 = hashes.sdbm(str);
    let added = false;

    for (let round = 0; round <= HASH_ROUNDS; round++) {
        const new_hash = round === 0
                        ? h1
                        : round === 1
                        ? h2
                        : (h1 + (round * h2) + (round ^ 2)) % BUFFER_LEN;
        const extra_indices = new_hash % 8;
        const index = ((new_hash - extra_indices) / 8);

        if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) === 0) {
            bVector[index] ^= (128 >> extra_indices - 1);
            added = true;
        } else if (extra_indices === 0 && (bVector[index] & 1) === 0) {
            bVector[index] ^= 1;
            added = true;
        }
    };
    return added;
  };

  const addEntries = arr => {
    if (!Array.isArray(arr)) {
        throw Error("Usage: <obj>.addEntries([val1, val2, ...rest])");
    }
    arr.forEach( (_, idx, theArr) => addEntry(theArr[theArr.length - 1 - idx ]) );
    return true;
  };

  const checkEntry = str => {
    if (typeof str !== 'string' ) {
        throw Error("Error: function expects input of type string");
    }

    const h1 = hashes.djb2(str);
    let extra_indices = h1 % 8;
    let index = ((h1 - extra_indices) / 8);
    if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) === 0) {
      return false;
    } else if (extra_indices === 0 && (bVector[index] & 1) === 0) {
      return false;
    }

    const h2 = hashes.sdbm(str);
    extra_indices = h2 % 8;
    index = ((h2 - extra_indices) / 8);
    if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) === 0) {
      return false;
    } else if (extra_indices === 0 && (bVector[index] & 1) === 0) {
      return false;
    }

    for (let round = 2; round <= HASH_ROUNDS; round++) {
      const new_hash = round === 0
                      ? h1
                      : round === 1
                      ? h2
                      : (h1 + (round * h2) + (round ^ 2)) % BUFFER_LEN;
      const extra_indices = new_hash % 8;
      const index = ((new_hash - extra_indices) / 8);

      if (extra_indices != 0 && (bVector[index] & (128 >> (extra_indices - 1))) === 0) {
          return false;
      } else if (extra_indices === 0 && (bVector[index] & 1) === 0) {
          return false;
      }
    }
    return true;
  };

  const importData = (lzData, k) => {
    const raw_data = LZString.decompressFromBase64(lzData);
    const data = raw_data.split(',');

    BUFFER_LEN = data.length * 8;
    HASH_ROUNDS = (typeof k !== "undefined") ? k : HASH_ROUNDS;
    bVector = new Uint8Array(data)
  };

  const exportData = cb => typeof cb == 'function'
                              ? cb(LZString.compressToBase64(bVector.toString()))
                              : LZString.compressToBase64(bVector.toString());

  return {
    info: {
      type: "regular",
      buffer: BUFFER_LEN,
      hashes: HASH_ROUNDS,
      raw_buffer: bVector
    },
    hashingMethods: hashes,
    addEntry: addEntry,
    addEntries: addEntries,
    checkEntry: checkEntry,
    importData: importData,
    exportData: exportData
  };
}

module.exports = JSBloom;