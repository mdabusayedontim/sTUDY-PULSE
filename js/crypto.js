/* ============================================================
   crypto.js — password hashing utilities

   Primary path : Web Crypto PBKDF2-SHA256 (150,000 iterations)
   Fallback path: in-page SHA-256 based iterated KDF, used when
                  crypto.subtle is unavailable (e.g. file:// or
                  older browsers).

   Exposes: window.PasswordCrypto
   ============================================================ */
(function (global) {
  'use strict';

  var PBKDF2_ITERATIONS = 150000;
  var FALLBACK_ITERATIONS = 60000;
  var SALT_BYTES = 16;
  var KEY_BYTES = 32;

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Bytes(bytes) {
    var H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    var len = bytes.length;
    var bitLenLo = (len << 3) >>> 0;
    var bitLenHi = Math.floor(len / 536870912);

    var withOne = len + 1;
    var pad = (56 - (withOne % 64) + 64) % 64;
    var total = withOne + pad + 8;
    var msg = new Uint8Array(total);
    msg.set(bytes);
    msg[len] = 0x80;

    var dv = new DataView(msg.buffer);
    dv.setUint32(total - 8, bitLenHi, false);
    dv.setUint32(total - 4, bitLenLo, false);

    var w = new Uint32Array(64);

    for (var off = 0; off < total; off += 64) {
      var t;
      for (t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4, false);
      for (t = 16; t < 64; t++) {
        var w15 = w[t - 15], w2 = w[t - 2];
        var s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
        var s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3];
      var e = H[4], f = H[5], g = H[6], h = H[7];

      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;

        h = g; g = f; f = e;
        e = (d + temp1) >>> 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    var out = new Uint8Array(32);
    var odv = new DataView(out.buffer);
    for (var i = 0; i < 8; i++) odv.setUint32(i * 4, H[i], false);
    return out;
  }

  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += (bytes[i] >>> 4).toString(16) + (bytes[i] & 15).toString(16);
    }
    return hex;
  }

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(out);
  }

  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  function randomSaltHex() {
    var bytes = new Uint8Array(SALT_BYTES);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return bytesToHex(bytes);
  }

  function randomTokenHex() {
    var bytes = new Uint8Array(32);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return bytesToHex(bytes);
  }

  function hasSubtle() {
    return !!(global.crypto && global.crypto.subtle && global.crypto.subtle.importKey);
  }

  function pbkdf2Subtle(password, saltHex, iterations) {
    return global.crypto.subtle
      .importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (keyMaterial) {
        return global.crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: iterations, hash: 'SHA-256' },
          keyMaterial,
          KEY_BYTES * 8
        );
      })
      .then(function (bits) { return bytesToHex(new Uint8Array(bits)); });
  }

  function pbkdf2Fallback(password, saltHex, iterations) {
    var salt = hexToBytes(saltHex);
    var block = concat(salt, utf8(password));
    var digest = sha256Bytes(block);
    for (var i = 1; i < iterations; i++) {
      digest = sha256Bytes(concat(salt, digest));
    }
    return Promise.resolve(bytesToHex(digest));
  }

  var PasswordCrypto = {
    isStrong: hasSubtle,
    newSalt: randomSaltHex,
    newToken: randomTokenHex,
    iterations: function () { return hasSubtle() ? PBKDF2_ITERATIONS : FALLBACK_ITERATIONS; },
    algo: function () { return hasSubtle() ? 'PBKDF2-SHA256' : 'SHA256-KDF'; },

    derive: function (password, saltHex, iterations) {
      var iters = iterations || PasswordCrypto.iterations();
      try { if (hasSubtle()) return pbkdf2Subtle(password, saltHex, iters); }
      catch (e) { /* fall through */ }
      return pbkdf2Fallback(password, saltHex, iters);
    },

    safeEqual: function (a, b) {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      if (a.length !== b.length) return false;
      var diff = 0;
      for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return diff === 0;
    },

    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes
  };

  global.PasswordCrypto = PasswordCrypto;
})(window);
