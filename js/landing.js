/* ============================================================
   landing.js — landing page interactions + auth forms
   ============================================================ */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function showToast(message, type) {
    var host = $('#toastHost');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 3600);
  }

  function setFieldError(fieldEl, message) {
    if (!fieldEl) return;
    var errEl = $('[data-err]', fieldEl);
    if (message) { fieldEl.classList.add('has-error'); if (errEl) errEl.textContent = message; }
    else { fieldEl.classList.remove('has-error'); if (errEl) errEl.textContent = ''; }
  }

  function clearFormErrors(form) {
    $$('.field', form).forEach(function (f) { setFieldError(f, ''); });
    var alert = $('.form-alert', form);
    if (alert) { alert.className = 'form-alert'; alert.textContent = ''; }
  }

  function showAlert(form, message, type) {
    var alert = $('.form-alert', form);
    if (!alert) return;
    alert.className = 'form-alert show ' + (type || 'error');
    alert.textContent = message;
  }

  function setLoading(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.disabled = true;
      btn.classList.add('is-loading');
      if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> ' + (label || 'Working…');
    } else {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
    }
  }

  var themeBtn = $('#themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('sp:theme', next); } catch (e) {}
    });
  }

  var nav = $('#nav');
  function onScroll() { if (nav) nav.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var modal = $('#authModal');
  var activeTab = 'signin';

  function openAuth(tab) {
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    switchTab(tab || 'signin');
    setTimeout(function () {
      var input = tab === 'signup' ? $('#su-name') : $('#si-email');
      if (input) input.focus();
    }, 220);
  }

  function closeAuth() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function switchTab(tab) {
    activeTab = tab;
    $$('.auth-tab').forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.auth-form').forEach(function (f) {
      f.classList.toggle('hidden', f.dataset.panel !== tab);
    });
  }

  $$('[data-auth]').forEach(function (btn) {
    btn.addEventListener('click', function () { openAuth(btn.dataset.auth); });
  });
  $$('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.goto); });
  });
  $$('.auth-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  var closeBtn = $('#authClose');
  if (closeBtn) closeBtn.addEventListener('click', closeAuth);

  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeAuth(); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeAuth();
  });

  if (location.hash === '#signin' || location.hash === '#signup') {
    openAuth(location.hash.slice(1));
  }

  $$('.toggle-visibility').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.dataset.toggle);
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.style.color = show ? 'var(--brand)' : '';
    });
  });

  var pwInput = $('#su-pw');
  var strengthEl = $('#pwStrength');
  var strengthLabel = $('#pwStrengthLabel');

  function scorePassword(pw) {
    if (!pw) return 0;
    var score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(4, score);
  }

  var STRENGTH_TEXT = [
    'Use 8+ characters with a mix of letters, numbers & symbols.',
    'Weak — add more characters.',
    'Fair — mix upper and lower case.',
    'Good — add a symbol for extra safety.',
    'Strong password. Nice work.'
  ];

  if (pwInput && strengthEl) {
    pwInput.addEventListener('input', function () {
      var s = scorePassword(pwInput.value);
      strengthEl.dataset.score = String(s);
      if (strengthLabel) strengthLabel.textContent = STRENGTH_TEXT[s];
    });
  }

  var signinForm = $('#signinForm');
  if (signinForm) {
    signinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormErrors(signinForm);

      var email = $('#si-email').value.trim();
      var password = $('#si-pw').value;
      var remember = $('#si-remember').checked;

      var bad = false;
      if (!email) { setFieldError($('#si-email-field'), 'Email is required.'); bad = true; }
      if (!password) { setFieldError($('#si-pw-field'), 'Password is required.'); bad = true; }
      if (bad) return;

      var submit = $('#si-submit');
      setLoading(submit, true, 'Signing in…');

      Auth.signin({ email: email, password: password, remember: remember })
        .then(function (res) {
          setLoading(submit, false);
          if (!res.ok) {
            if (res.field === 'email') setFieldError($('#si-email-field'), res.error);
            else if (res.field === 'password') setFieldError($('#si-pw-field'), res.error);
            else showAlert(signinForm, res.error, 'error');
            return;
          }
          showAlert(signinForm, 'Signed in! Loading your dashboard…', 'success');
          setTimeout(function () { window.location.href = 'app.html'; }, 500);
        })
        .catch(function () {
          setLoading(submit, false);
          showAlert(signinForm, 'Unexpected error. Please try again.', 'error');
        });
    });
  }

  var signupForm = $('#signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearFormErrors(signupForm);

      var name = $('#su-name').value.trim();
      var email = $('#su-email').value.trim();
      var pw = $('#su-pw').value;
      var pw2 = $('#su-pw2').value;
      var terms = $('#su-terms').checked;

      var bad = false;

      if (name.length < 2) { setFieldError($('#su-name-field'), 'Please enter your full name.'); bad = true; }
      if (!Auth.isValidEmail(email)) { setFieldError($('#su-email-field'), 'Please enter a valid email address.'); bad = true; }
      else if (Auth.isEmailTaken(email)) { setFieldError($('#su-email-field'), 'An account with this email already exists.'); bad = true; }

      var problems = Auth.passwordProblems(pw);
      if (problems.length) { setFieldError($('#su-pw-field'), 'Password needs ' + problems.join(', ') + '.'); bad = true; }
      else if (pw !== pw2) { setFieldError($('#su-pw2-field'), 'Passwords do not match.'); bad = true; }

      if (!terms) { showAlert(signupForm, 'Please tick the checkbox to continue.', 'error'); bad = true; }
      if (bad) return;

      var submit = $('#su-submit');
      setLoading(submit, true, 'Creating account…');

      Auth.signup({ name: name, email: email, password: pw })
        .then(function (res) {
          setLoading(submit, false);
          if (!res.ok) {
            if (res.field === 'name') setFieldError($('#su-name-field'), res.error);
            else if (res.field === 'email') setFieldError($('#su-email-field'), res.error);
            else if (res.field === 'password') setFieldError($('#su-pw-field'), res.error);
            else showAlert(signupForm, res.error, 'error');
            return;
          }
          showAlert(signupForm, 'Account created! Setting up your dashboard…', 'success');
          setTimeout(function () { window.location.href = 'app.html'; }, 550);
        })
        .catch(function () {
          setLoading(submit, false);
          showAlert(signupForm, 'Unexpected error. Please try again.', 'error');
        });
    });
  }

  var forgot = $('#forgotLink');
  if (forgot) {
    forgot.addEventListener('click', function () {
      showToast('This is a local-only app — there is no email reset. Create a new account or clear browser storage.', 'warn');
    });
  }

  if (typeof Auth !== 'undefined' && Auth.isSignedIn()) {
    window.location.replace('app.html');
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('animate-in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });

    $$('.feature, .steps li, .stat, .security-card, .cta-inner').forEach(function (el) { io.observe(el); });
  }
})();
