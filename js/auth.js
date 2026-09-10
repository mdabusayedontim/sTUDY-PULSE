/* ============================================================
   auth.js — local account system
   Exposes: window.Auth
   ============================================================ */
(function (global) {
  'use strict';

  var USERS_KEY = 'sp:users';
  var SESSION_KEY = 'sp:session';
  var REMEMBER_DAYS = 30;
  var SESSION_HOURS = 12;

  var PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9'];

  function readJSON(store, key, fallback) {
    try {
      var raw = store.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) { return fallback; }
  }

  function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('[Auth] write failed', key, e); return false; }
  }

  function getUsers() {
    var users = readJSON(localStorage, USERS_KEY, []);
    return Array.isArray(users) ? users : [];
  }
  function setUsers(users) { return writeJSON(localStorage, USERS_KEY, users); }

  function readSession() {
    var s = readJSON(localStorage, SESSION_KEY, null);
    if (s) return s;
    return readJSON(sessionStorage, SESSION_KEY, null);
  }
  function writeSession(session, remember) {
    clearSession();
    if (remember) writeJSON(localStorage, SESSION_KEY, session);
    else writeJSON(sessionStorage, SESSION_KEY, session);
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
  function isValidEmail(email) { return EMAIL_RE.test(normalizeEmail(email)); }

  function passwordProblems(password) {
    var problems = [];
    if (!password || password.length < 8) problems.push('at least 8 characters');
    if (password && !/[a-zA-Z]/.test(password)) problems.push('one letter');
    if (password && !/[0-9]/.test(password)) problems.push('one number');
    return problems;
  }

  function newId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function pickColor(seed) {
    var n = 0;
    for (var i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i)) % 997;
    return PALETTE[n % PALETTE.length];
  }

  function initialsOf(name) {
    var parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function publicUser(record) {
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      color: record.color,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
      initials: initialsOf(record.name)
    };
  }

  var Auth = {
    userCount: function () { return getUsers().length; },

    isEmailTaken: function (email) {
      var e = normalizeEmail(email);
      return getUsers().some(function (u) { return u.emailLower === e; });
    },

    isValidEmail: isValidEmail,
    passwordProblems: passwordProblems,
    normalizeEmail: normalizeEmail,
    initialsOf: initialsOf,

    signup: function (input) {
      var name = String(input.name || '').trim();
      var email = String(input.email || '').trim();
      var password = String(input.password || '');

      if (name.length < 2) return Promise.resolve({ ok: false, error: 'Please enter your full name.', field: 'name' });
      if (!isValidEmail(email)) return Promise.resolve({ ok: false, error: 'Please enter a valid email address.', field: 'email' });
      if (Auth.isEmailTaken(email)) return Promise.resolve({ ok: false, error: 'An account with this email already exists.', field: 'email' });

      var problems = passwordProblems(password);
      if (problems.length) return Promise.resolve({ ok: false, error: 'Password needs ' + problems.join(', ') + '.', field: 'password' });

      var salt = global.PasswordCrypto.newSalt();
      var iterations = global.PasswordCrypto.iterations();

      return global.PasswordCrypto.derive(password, salt, iterations).then(function (hash) {
        var record = {
          id: newId('u'),
          name: name,
          email: email,
          emailLower: normalizeEmail(email),
          salt: salt,
          hash: hash,
          iterations: iterations,
          algo: global.PasswordCrypto.algo(),
          color: pickColor(name + email),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        var users = getUsers();
        users.push(record);
        if (!setUsers(users)) return { ok: false, error: 'Could not save your account — storage may be full or blocked.' };

        Auth._startSession(record, true);
        return { ok: true, user: publicUser(record) };
      }).catch(function (err) {
        console.error('[Auth] signup failed', err);
        return { ok: false, error: 'Something went wrong while creating your account.' };
      });
    },

    signin: function (input) {
      var email = normalizeEmail(input.email);
      var password = String(input.password || '');
      var remember = input.remember !== false;

      if (!email) return Promise.resolve({ ok: false, error: 'Please enter your email address.', field: 'email' });
      if (!password) return Promise.resolve({ ok: false, error: 'Please enter your password.', field: 'password' });

      var users = getUsers();
      var record = users.find(function (u) { return u.emailLower === email; });

      if (!record) return Promise.resolve({ ok: false, error: 'No account found with that email address.', field: 'email' });

      return global.PasswordCrypto
        .derive(password, record.salt, record.iterations)
        .then(function (hash) {
          if (!global.PasswordCrypto.safeEqual(hash, record.hash)) {
            return { ok: false, error: 'Incorrect password. Please try again.', field: 'password' };
          }
          record.lastLoginAt = new Date().toISOString();
          setUsers(users);
          Auth._startSession(record, remember);
          return { ok: true, user: publicUser(record) };
        })
        .catch(function (err) {
          console.error('[Auth] signin failed', err);
          return { ok: false, error: 'Something went wrong while signing you in.' };
        });
    },

    _startSession: function (record, remember) {
      var now = Date.now();
      var ttl = remember ? REMEMBER_DAYS * 24 * 60 * 60 * 1000 : SESSION_HOURS * 60 * 60 * 1000;
      var session = {
        token: global.PasswordCrypto.newToken(),
        userId: record.id,
        issuedAt: now,
        expiresAt: now + ttl,
        remember: !!remember
      };
      writeSession(session, remember);
      return session;
    },

    currentUser: function () {
      var session = readSession();
      if (!session || !session.userId) return null;
      if (!session.expiresAt || Date.now() > session.expiresAt) { clearSession(); return null; }
      var record = getUsers().find(function (u) { return u.id === session.userId; });
      if (!record) { clearSession(); return null; }
      return publicUser(record);
    },

    currentRecord: function () {
      var session = readSession();
      if (!session) return null;
      return getUsers().find(function (u) { return u.id === session.userId; }) || null;
    },

    isSignedIn: function () { return Auth.currentUser() !== null; },

    signout: function () { clearSession(); },

    requireAuth: function (redirectTo) {
      var user = Auth.currentUser();
      if (!user) { window.location.replace(redirectTo || 'index.html'); return null; }
      return user;
    },

    redirectIfSignedIn: function (target) {
      if (Auth.isSignedIn()) { window.location.replace(target || 'app.html'); return true; }
      return false;
    },

    updateProfile: function (patch) {
      var record = Auth.currentRecord();
      if (!record) return { ok: false, error: 'Not signed in.' };

      if (typeof patch.name === 'string') {
        var name = patch.name.trim();
        if (name.length < 2) return { ok: false, error: 'Name must be at least 2 characters.', field: 'name' };
        record.name = name;
      }
      if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color)) {
        record.color = patch.color;
      }

      var users = getUsers();
      var idx = users.findIndex(function (u) { return u.id === record.id; });
      if (idx === -1) return { ok: false, error: 'Account not found.' };
      users[idx] = record;
      setUsers(users);
      return { ok: true, user: publicUser(record) };
    },

    changePassword: function (currentPassword, nextPassword) {
      var record = Auth.currentRecord();
      if (!record) return Promise.resolve({ ok: false, error: 'Not signed in.' });

      var problems = passwordProblems(nextPassword);
      if (problems.length) return Promise.resolve({ ok: false, error: 'New password needs ' + problems.join(', ') + '.', field: 'next' });

      return global.PasswordCrypto
        .derive(String(currentPassword || ''), record.salt, record.iterations)
        .then(function (hash) {
          if (!global.PasswordCrypto.safeEqual(hash, record.hash)) {
            return { ok: false, error: 'Current password is incorrect.', field: 'current' };
          }
          var salt = global.PasswordCrypto.newSalt();
          var iterations = global.PasswordCrypto.iterations();
          return global.PasswordCrypto.derive(nextPassword, salt, iterations).then(function (newHash) {
            record.salt = salt;
            record.hash = newHash;
            record.iterations = iterations;
            record.algo = global.PasswordCrypto.algo();
            var users = getUsers();
            var idx = users.findIndex(function (u) { return u.id === record.id; });
            users[idx] = record;
            setUsers(users);
            return { ok: true };
          });
        })
        .catch(function (err) {
          console.error('[Auth] changePassword failed', err);
          return { ok: false, error: 'Could not update your password.' };
        });
    },

    deleteAccount: function (password) {
      var record = Auth.currentRecord();
      if (!record) return Promise.resolve({ ok: false, error: 'Not signed in.' });

      return global.PasswordCrypto
        .derive(String(password || ''), record.salt, record.iterations)
        .then(function (hash) {
          if (!global.PasswordCrypto.safeEqual(hash, record.hash)) {
            return { ok: false, error: 'Password is incorrect.', field: 'password' };
          }
          var users = getUsers().filter(function (u) { return u.id !== record.id; });
          setUsers(users);
          try { localStorage.removeItem('sp:data:' + record.id); } catch (e) {}
          clearSession();
          return { ok: true };
        })
        .catch(function (err) {
          console.error('[Auth] deleteAccount failed', err);
          return { ok: false, error: 'Could not delete your account.' };
        });
    },

    PALETTE: PALETTE
  };

  global.Auth = Auth;
})(window);
