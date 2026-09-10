/* ============================================================
   app.js — authenticated dashboard application
   Depends on: crypto.js, auth.js, store.js
   Charts are optional — if Chart.js failed to load the rest still works.
   ============================================================ */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function fmtDate(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var opts = { month: 'short', day: 'numeric' };
    if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return d.toLocaleDateString(undefined, opts);
  }

  function daysUntil(iso) {
    var target = new Date(iso + 'T00:00:00');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

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

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    if (!$('.modal.open')) document.body.style.overflow = '';
  }

  function closeAllModals() {
    $$('.modal.open').forEach(function (m) { m.classList.remove('open'); });
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      var modal = closeBtn.closest('.modal');
      if (modal) closeModal(modal.id);
      return;
    }
    if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target.id);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllModals();
  });

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-modal]');
    if (trigger) openModal(trigger.dataset.modal);
  });

  var confirmResolve = null;
  function askConfirm(title, message, okLabel, onOk) {
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    $('#confirmOk').textContent = okLabel || 'Confirm';
    confirmResolve = onOk;
    openModal('confirmModal');
  }
  $('#confirmOk').addEventListener('click', function () {
    var fn = confirmResolve;
    confirmResolve = null;
    closeModal('confirmModal');
    if (typeof fn === 'function') fn();
  });

  $('#themeBtn').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('sp:theme', next); } catch (e) {}
    if (currentView === 'analytics') renderCharts();
  });

  var userTrigger = $('#userTrigger');
  var userDropdown = $('#userDropdown');

  userTrigger.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = userDropdown.classList.toggle('open');
    userTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function () {
    userDropdown.classList.remove('open');
    userTrigger.setAttribute('aria-expanded', 'false');
  });
  userDropdown.addEventListener('click', function (e) { e.stopPropagation(); });

  var currentUser = window.__SP_USER__ || Auth.currentUser();
  if (!currentUser) { window.location.replace('index.html'); return; }

  var hasExistingData = false;
  try { hasExistingData = !!localStorage.getItem('sp:data:' + currentUser.id); } catch (e) {}
  Store.init(currentUser.id, { seed: !hasExistingData });

  function refreshUserChrome() {
    currentUser = Auth.currentUser() || currentUser;
    var initials = currentUser.initials || Auth.initialsOf(currentUser.name);
    $('#headerAvatar').textContent = initials;
    $('#menuAvatar').textContent = initials;
    $('#headerUserName').textContent = currentUser.name;
    $('#menuUserName').textContent = currentUser.name;
    $('#menuUserEmail').textContent = currentUser.email;
    $('#headerAvatar').style.background = currentUser.color;
    $('#menuAvatar').style.background = currentUser.color;
    $('#profileAvatar').style.background = currentUser.color;
  }

  var currentView = 'dashboard';

  function switchView(name) {
    currentView = name;
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    $$('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name); });
    if (name === 'analytics') setTimeout(renderCharts, 30);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.tab').forEach(function (tab) { tab.addEventListener('click', function () { switchView(tab.dataset.view); }); });
  $$('[data-goto]').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.dataset.goto); }); });

  var QUOTES = [
    'Success is the sum of small efforts, repeated day in and day out.',
    'The expert in anything was once a beginner.',
    'Discipline beats motivation. Show up anyway.',
    'Small daily improvements are the key to staggering long-term results.',
    'You do not rise to the level of your goals. You fall to the level of your systems.',
    'Focus is saying no to a hundred good ideas.',
    'It always seems impossible until it is done.'
  ];

  function greetingFor(hour) {
    if (hour < 5) return 'Still up';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }

  function renderBanner() {
    var hour = new Date().getHours();
    var first = currentUser.name.split(/\s+/)[0];
    $('#bannerGreeting').textContent = greetingFor(hour) + ', ' + first + '.';

    var dayIdx = Math.floor(Date.now() / 86400000) % QUOTES.length;
    $('#bannerQuote').textContent = '"' + QUOTES[dayIdx] + '"';

    var pending = Store.data.tasks.filter(function (t) { return !t.completed; });
    var urgent = pending.filter(function (t) { var d = daysUntil(t.dueDate); return d >= 0 && d <= 3; }).length;

    var tag = 'Exam season readiness';
    if (urgent > 0) tag = urgent + ' deadline' + (urgent === 1 ? '' : 's') + ' within 3 days';
    else if (pending.length > 0) tag = pending.length + ' open task' + (pending.length === 1 ? '' : 's');
    else if (Store.data.sessions.length === 0) tag = 'Fresh start — add a subject';
    else tag = 'All caught up 🎉';

    $('#bannerTag').textContent = tag;
  }

  function kpiCard(opts) {
    return '' +
      '<div class="kpi">' +
        '<div class="kpi-top">' +
          '<span class="kpi-label">' + escapeHtml(opts.label) + '</span>' +
          '<span class="kpi-icon ' + opts.tone + '">' + opts.icon + '</span>' +
        '</div>' +
        '<div class="kpi-value"><strong>' + escapeHtml(opts.value) + '</strong><span>' + escapeHtml(opts.unit) + '</span></div>' +
        (opts.bar != null
          ? '<div class="progress thin"><span style="width:' + opts.bar + '%;background:' + (opts.barColor || 'var(--brand)') + '"></span></div>'
          : '') +
        '<div class="kpi-foot">' + escapeHtml(opts.foot) + '</div>' +
      '</div>';
  }

  var ICONS = {
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h8l-1 8 10-12h-8z"/></svg>'
  };

  function renderKpis() {
    var syl = Store.syllabusStats();
    var weekly = Store.weeklyHours();
    var target = 20;
    var pending = Store.data.tasks.filter(function (t) { return !t.completed; });
    var next = pending.slice().sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); })[0];

    var html = '';
    html += kpiCard({
      label: 'Syllabus complete', tone: 'blue', icon: ICONS.pie,
      value: syl.percent + '%', unit: syl.completed + ' / ' + syl.total + ' topics',
      bar: syl.percent, barColor: '#6366f1',
      foot: syl.total === 0 ? 'Add topics to start tracking' : 'Across ' + Store.data.subjects.length + ' subjects'
    });
    html += kpiCard({
      label: 'Study time this week', tone: 'violet', icon: ICONS.clock,
      value: String(weekly), unit: 'of ' + target + ' hrs',
      bar: Math.min(100, Math.round((weekly / target) * 100)), barColor: '#8b5cf6',
      foot: weekly >= target ? 'Target reached — excellent!' : (target - weekly).toFixed(1) + ' hrs to reach your goal'
    });
    html += kpiCard({
      label: 'Open deadlines', tone: 'amber', icon: ICONS.cal,
      value: String(pending.length), unit: pending.length === 1 ? 'task' : 'tasks',
      bar: null,
      foot: next ? 'Next: ' + next.title : 'Nothing pending 🎉'
    });
    html += kpiCard({
      label: 'Current streak', tone: 'rose', icon: ICONS.zap,
      value: String(Store.data.streak || 0), unit: 'days',
      bar: null,
      foot: 'Last active: ' + (Store.data.lastActiveDate || '—')
    });

    $('#kpiGrid').innerHTML = html;
  }

  function renderDashboardSubjects() {
    var host = $('#dashboardSubjects');
    var subjects = Store.data.subjects;

    if (subjects.length === 0) {
      host.innerHTML = '<p class="text-sm text-muted" style="grid-column:1/-1;padding:16px 0">No subjects yet. Add one to get started.</p>';
      return;
    }

    host.innerHTML = subjects.slice(0, 4).map(function (s) {
      var topics = s.topics || [];
      var done = topics.filter(function (t) { return t.completed; }).length;
      var pct = topics.length === 0 ? 0 : Math.round((done / topics.length) * 100);
      return '' +
        '<div class="subject-mini">' +
          '<div class="subject-mini-top">' +
            '<span class="dot" style="background:' + s.color + '"></span>' +
            '<span class="subject-mini-pct">' + pct + '%</span>' +
          '</div>' +
          '<h4 class="truncate">' + escapeHtml(s.name) + '</h4>' +
          '<p>' + done + ' of ' + topics.length + ' topics</p>' +
          '<div class="progress thin"><span style="width:' + pct + '%;background:' + s.color + '"></span></div>' +
        '</div>';
    }).join('');
  }

  function renderDashboardTasks() {
    var host = $('#dashboardTasks');
    var tasks = Store.data.tasks
      .slice()
      .sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); })
      .slice(0, 5);

    if (tasks.length === 0) {
      host.innerHTML = '<p class="text-sm text-muted" style="padding:12px 0">No deadlines yet. Enjoy the calm.</p>';
      return;
    }

    host.innerHTML = tasks.map(function (t) {
      var sub = Store.subjectById(t.subjectId);
      var d = daysUntil(t.dueDate);
      var urgent = d <= 2 && !t.completed;
      var label = t.completed ? 'Done' : d < 0 ? 'Overdue' : d === 0 ? 'Today' : d + 'd left';

      return '' +
        '<div class="task-row">' +
          '<div class="task-row-main">' +
            '<input type="checkbox" class="task-check" data-task-toggle="' + t.id + '"' + (t.completed ? ' checked' : '') + '>' +
            '<div style="min-width:0">' +
              '<div class="task-title' + (t.completed ? ' done' : '') + ' truncate">' + escapeHtml(t.title) + '</div>' +
              '<div class="task-meta">' +
                '<span class="dot" style="width:7px;height:7px;background:' +
