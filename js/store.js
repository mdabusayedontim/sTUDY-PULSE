/* ============================================================
   store.js — per-user study data layer
   Exposes: window.Store
   ============================================================ */
(function (global) {
  'use strict';

  var VERSION = 2;
  var keyFor = function (userId) { return 'sp:data:' + userId; };

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function daysFromNow(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function seedData() {
    return {
      version: VERSION,
      subjects: [
        {
          id: 'sub-1', name: 'Computer Science: Algorithms', color: '#6366f1',
          targetHours: 6, notes: 'Prof. Sanders — Mon/Wed 10 AM',
          topics: [
            { id: 'top-1-1', title: 'Asymptotic Notation & Big-O', completed: true },
            { id: 'top-1-2', title: 'Divide and Conquer (MergeSort, QuickSort)', completed: true },
            { id: 'top-1-3', title: 'Dynamic Programming & Memoization', completed: false },
            { id: 'top-1-4', title: 'Graph Traversal (BFS / DFS)', completed: false },
            { id: 'top-1-5', title: 'Dijkstra & Minimum Spanning Trees', completed: false }
          ]
        },
        {
          id: 'sub-2', name: 'Linear Algebra & Calculus', color: '#06b6d4',
          targetHours: 5, notes: 'Hall B — Textbook Ch. 1–8',
          topics: [
            { id: 'top-2-1', title: 'Matrix Multiplication & Inverses', completed: true },
            { id: 'top-2-2', title: 'Vector Spaces & Subspaces', completed: true },
            { id: 'top-2-3', title: 'Eigenvalues & Eigenvectors', completed: true },
            { id: 'top-2-4', title: 'Partial Derivatives & Gradients', completed: false }
          ]
        },
        {
          id: 'sub-3', name: 'Cellular Biology', color: '#10b981',
          targetHours: 4, notes: 'Lab work on Thursdays',
          topics: [
            { id: 'top-3-1', title: 'Membrane Transport Mechanisms', completed: true },
            { id: 'top-3-2', title: 'Cellular Respiration & Krebs Cycle', completed: true },
            { id: 'top-3-3', title: 'DNA Replication & Repair', completed: false },
            { id: 'top-3-4', title: 'Signal Transduction Pathways', completed: false }
          ]
        },
        {
          id: 'sub-4', name: 'World History & Diplomacy', color: '#f59e0b',
          targetHours: 3, notes: 'Term paper due next month',
          topics: [
            { id: 'top-4-1', title: 'Treaty of Westphalia & Statehood', completed: true },
            { id: 'top-4-2', title: 'Industrial Revolution Impact', completed: false },
            { id: 'top-4-3', title: 'Cold War Geopolitics', completed: false }
          ]
        }
      ],
      tasks: [
        { id: 'task-1', subjectId: 'sub-1', title: 'Algorithms Midterm Exam', type: 'Exam', dueDate: daysFromNow(2), priority: 'High', completed: false },
        { id: 'task-2', subjectId: 'sub-2', title: 'Linear Algebra Problem Set #4', type: 'Assignment', dueDate: daysFromNow(4), priority: 'Medium', completed: false },
        { id: 'task-3', subjectId: 'sub-3', title: 'Bio Lab Report: Enzyme Kinetics', type: 'Project', dueDate: daysFromNow(6), priority: 'High', completed: false },
        { id: 'task-4', subjectId: 'sub-4', title: 'History Discussion Reading Essay', type: 'Quiz', dueDate: daysFromNow(8), priority: 'Low', completed: true }
      ],
      sessions: [
        { id: 'sess-1', subjectId: 'sub-1', durationMinutes: 50, timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), notes: 'Mastered QuickSort partition logic' },
        { id: 'sess-2', subjectId: 'sub-2', durationMinutes: 45, timestamp: new Date(Date.now() - 86400000).toISOString(), notes: 'Eigenvalue proofs and practice' },
        { id: 'sess-3', subjectId: 'sub-3', durationMinutes: 60, timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), notes: 'Cell respiration flashcards' },
        { id: 'sess-4', subjectId: 'sub-1', durationMinutes: 30, timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), notes: 'Big-O runtime exercises' },
        { id: 'sess-5', subjectId: 'sub-4', durationMinutes: 40, timestamp: new Date(Date.now() - 86400000 * 4).toISOString(), notes: 'Read Treaty of Westphalia context' }
      ],
      streak: 5,
      lastActiveDate: todayISO()
    };
  }

  function emptyData() {
    return { version: VERSION, subjects: [], tasks: [], sessions: [], streak: 0, lastActiveDate: null };
  }

  function migrate(data) {
    if (!data || typeof data !== 'object') return emptyData();
    data.version = VERSION;
    if (!Array.isArray(data.subjects)) data.subjects = [];
    if (!Array.isArray(data.tasks)) data.tasks = [];
    if (!Array.isArray(data.sessions)) data.sessions = [];
    if (typeof data.streak !== 'number') data.streak = 0;
    if (!('lastActiveDate' in data)) data.lastActiveDate = null;

    data.subjects.forEach(function (s) {
      if (!Array.isArray(s.topics)) s.topics = [];
      if (typeof s.targetHours !== 'number') s.targetHours = 5;
      if (!s.color) s.color = '#6366f1';
      s.topics.forEach(function (t) { t.completed = !!t.completed; });
    });

    data.tasks.forEach(function (t) {
      t.completed = !!t.completed;
      if (!t.priority) t.priority = 'Medium';
      if (!t.type) t.type = 'Assignment';
    });

    return data;
  }

  var Store = {
    userId: null,
    data: null,
    seeded: false,

    init: function (userId, options) {
      options = options || {};
      Store.userId = userId;
      Store.seeded = false;

      var raw = null;
      try { raw = localStorage.getItem(keyFor(userId)); } catch (e) { console.error('[Store] localStorage unavailable', e); }

      if (raw) {
        try { Store.data = migrate(JSON.parse(raw)); }
        catch (e) { console.warn('[Store] corrupt data, resetting', e); Store.data = emptyData(); }
      } else if (options.seed) {
        Store.data = seedData();
        Store.seeded = true;
        Store.save();
      } else {
        Store.data = emptyData();
      }
      return Store.data;
    },

    save: function () {
      if (!Store.userId || !Store.data) return false;
      try { localStorage.setItem(keyFor(Store.userId), JSON.stringify(Store.data)); return true; }
      catch (e) { console.error('[Store] save failed', e); return false; }
    },

    reseed: function () { Store.data = seedData(); Store.save(); return Store.data; },
    clear:  function () { Store.data = emptyData(); Store.save(); return Store.data; },
    replaceAll: function (incoming) { Store.data = migrate(incoming); Store.save(); return Store.data; },

    syllabusStats: function () {
      var total = 0, done = 0;
      (Store.data.subjects || []).forEach(function (s) {
        var topics = s.topics || [];
        total += topics.length;
        done += topics.filter(function (t) { return t.completed; }).length;
      });
      return { total: total, completed: done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
    },

    weeklyHours: function () {
      var cutoff = Date.now() - 7 * 86400000;
      var minutes = 0;
      (Store.data.sessions || []).forEach(function (s) {
        var t = new Date(s.timestamp).getTime();
        if (!isNaN(t) && t >= cutoff) minutes += Number(s.durationMinutes) || 0;
      });
      return +(minutes / 60).toFixed(1);
    },

    todayStats: function () {
      var today = todayISO();
      var count = 0, minutes = 0;
      (Store.data.sessions || []).forEach(function (s) {
        var d = new Date(s.timestamp);
        var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (iso === today) { count++; minutes += Number(s.durationMinutes) || 0; }
      });
      return { count: count, minutes: minutes };
    },

    touchStreak: function () {
      var today = todayISO();
      var yesterday = daysFromNow(-1);
      var d = Store.data;
      if (d.lastActiveDate === today) return d.streak;
      d.streak = (d.lastActiveDate === yesterday) ? (d.streak || 0) + 1 : 1;
      d.lastActiveDate = today;
      return d.streak;
    },

    subjectById: function (id) {
      return (Store.data.subjects || []).find(function (s) { return s.id === id; }) || null;
    },

    uid: uid,
    todayISO: todayISO,
    daysFromNow: daysFromNow
  };

  global.Store = Store;
})(window);
