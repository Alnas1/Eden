/* ===== EDEN 剧情引擎 ===== */
(function () {
  'use strict';

  var SAVE_KEY = '***';
  var CUSTOM_KEY = '***';

  var D = JSON.parse(JSON.stringify(window.EDEN_DATA));

  // 合并编辑页导出的自定义内容（同 id 覆盖内置，新 id 追加）
  try {
    var custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null');
    if (custom && custom.nodes) {
      Object.keys(custom.nodes).forEach(function (id) { D.nodes[id] = custom.nodes[id]; });
    }
    if (custom && custom.items) {
      Object.keys(custom.items).forEach(function (id) { D.items[id] = custom.items[id]; });
    }
    if (custom && custom.collect) {
      Object.keys(custom.collect).forEach(function (id) { D.collect[id] = custom.collect[id]; });
    }
    if (custom && custom.map) { D.map = custom.map; }
    if (custom && custom.start) { D.start = custom.start; }
  } catch (e) { /* 坏数据就当没有 */ }

  function loadState() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.node || !D.nodes[s.node]) {
      s = {
        pod: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        day: 0, node: D.start, feed: [], items: [], collect: [],
        flags: {}, status: '正常运行', tab: 'log', auto: false
      };
      applyNode(D.nodes[D.start], s);
      s.feed = [D.start];
    }
    return s;
  }

  function applyNode(node, s) {
    if (!node) return;
    if (typeof node.days === 'number') s.day = node.days;
    if (node.status) s.status = node.status;
    (node.gain || []).forEach(function (i) { if (s.items.indexOf(i) < 0) s.items.push(i); });
    (node.unlock || []).forEach(function (c) { if (s.collect.indexOf(c) < 0) s.collect.push(c); });
    Object.keys(node.flags || {}).forEach(function (k) { s.flags[k] = node.flags[k]; });
  }

  var state = loadState();
  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  save();

  function pod(text) {
    return String(text).replace(/\?\?\?/g, state.pod);
  }

  var $view = document.getElementById('view');
  var $tabs = document.getElementById('tabbar');

  var TABS = [
    { id: 'log', label: 'log' },
    { id: 'auto', label: 'Auto', toggle: true },
    { id: 'map', label: '地图' },
    { id: 'hour', label: '沙漏' },
    { id: 'bag', label: '背包' },
    { id: 'album', label: '收藏' }
  ];

  function renderTabs() {
    $tabs.innerHTML = '';
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tab' + (t.toggle ? (state.auto ? ' on' : '') : (state.tab === t.id ? ' active' : ''));
      b.textContent = t.label;
      b.onclick = function () {
        if (t.toggle) { state.auto = !state.auto; }
        else { state.tab = t.id; }
        save(); render();
      };
      $tabs.appendChild(b);
    });
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function blockNode(node) {
    var box = el('div', 'block');
    if (node.speaker) box.appendChild(el('h2', null, esc(pod(node.speaker))));
    (node.text || []).forEach(function (p) {
      var isSys = /^[【—（]|摘要/.test(p);
      box.appendChild(el('p', isSys ? 'sys' : null, esc(pod(p))));
    });
    (node.gain || []).forEach(function (i) {
      box.appendChild(el('div', 'gain', '获得 <b>' + esc(pod(i)) + '</b>'));
    });
    return box;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function go(id) {
    var node = D.nodes[id];
    if (!node) { return; }
    applyNode(node, state);
    state.node = id;
    state.feed.push(id);
    if (state.tab !== 'log') state.tab = 'log';
    save(); render();
  }

  function renderLog() {
    var frag = document.createDocumentFragment();
    state.feed.forEach(function (id) {
      var n = D.nodes[id];
      if (n) frag.appendChild(blockNode(n));
    });
    var cur = D.nodes[state.node];
    var tail = el('div', 'choice-list');

    if (cur && cur.end) {
      tail.appendChild(el('div', 'endcard',
        '<b>第一章 · 完</b><br>倒计时已经开始了，' + esc(state.pod) + ' 号。<br>' +
        '第二章还没有出版——你可以在 dev.html 编辑页自己写一章，<br>导出后发给 AI 合进正式版。'));
      var again = el('button', 'btn plain', '重新开始（清掉存档）');
      again.onclick = reset;
      tail.appendChild(again);
    } else if (cur && cur.choices && cur.choices.length) {
      cur.choices.forEach(function (c) {
        var b = el('button', 'btn', esc(pod(c.t)));
        b.onclick = function () { go(c.to); };
        tail.appendChild(b);
      });
    } else if (cur && cur.next) {
      var cont = el('button', 'btn plain', '继 续');
      cont.onclick = function () { go(cur.next); };
      tail.appendChild(cont);
      if (state.auto) {
        window.__edenAuto = setTimeout(function () { go(cur.next); }, 2400);
      }
    } else {
      var back = el('button', 'btn plain', '回到 log');
      back.onclick = function () { state.tab = 'log'; save(); render(); };
      tail.appendChild(back);
    }
    frag.appendChild(tail);
    $view.appendChild(frag);
    $view.scrollTop = $view.scrollHeight;
  }

  function renderMap() {
    (D.map || []).forEach(function (m) {
      var r = el('div', 'row' + (m.locked ? ' locked' : '') + (m.here ? ' here' : ''));
      r.appendChild(el('b', null, esc(pod(m.name))));
      r.appendChild(el('div', 'desc', esc(pod(m.desc || ''))));
      if (m.here) r.appendChild(el('div', 'desc', '（你在这里）'));
      $view.appendChild(r);
    });
    $view.appendChild(el('div', 'note', '地图随剧情解锁。想加地点，用编辑页改 map 部分。'));
  }

  function renderHour() {
    $view.appendChild(el('div', 'countdown', state.day > 0 ? state.day + ' 天' : '— —'));
    $view.appendChild(el('div', 'countdown-label', '剩余有效时间 · 舱号 EDEN/' + state.pod));
    $view.appendChild(el('div', 'quote',
      '甲方：伊甸联合体<br>乙方：你<br>标的：全部剩余生命时间<br>' +
      '余额已冻结，不可充值，不可转让，不可退货。<br>处置预案：已预扣。'));
    if (state.flags['怀疑伊甸']) {
      $view.appendChild(el('div', 'note', '你开始留意这只 AI 的每一句「已排除故障」。'));
    }
    $view.appendChild(el('div', 'note', '天数只在剧情推进时变化——这一版先讲故事，不跑真实时间。'));
  }

  function renderBag() {
    if (!state.items.length) { $view.appendChild(el('div', 'empty', '背包是空的。伊甸说，很快就不会了。')); return; }
    state.items.forEach(function (name) {
      var it = D.items[name] || { icon: '📦', desc: '' };
      var r = el('div', 'row');
      r.appendChild(el('b', null, it.icon + ' ' + esc(pod(name))));
      if (it.desc) r.appendChild(el('div', 'desc', esc(pod(it.desc))));
      $view.appendChild(r);
    });
  }

  function renderAlbum() {
    var keys = Object.keys(D.collect || {});
    if (!keys.length) { $view.appendChild(el('div', 'empty', '还没有可收藏的东西。')); return; }
    keys.forEach(function (name) {
      var c = D.collect[name];
      var got = state.collect.indexOf(name) >= 0;
      var r = el('div', 'row' + (got ? '' : ' locked'));
      r.appendChild(el('b', null, (got ? c.icon : '❓') + ' ' + (got ? esc(name) : '？？？')));
      if (got && c.desc) r.appendChild(el('div', 'desc', esc(c.desc)));
      $view.appendChild(r);
    });
  }

  function reset() {
    if (!confirm('重新开始？这会清掉本机的存档（背包、收藏、天数都归零，舱号会换一个新的）。')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  function render() {
    if (window.__edenAuto) { clearTimeout(window.__edenAuto); window.__edenAuto = null; }
    document.getElementById('podnum').textContent = state.pod;
    document.getElementById('cabinstatus').textContent = pod(state.status);
    renderTabs();
    $view.innerHTML = '';
    if (state.tab === 'log') renderLog();
    else if (state.tab === 'map') renderMap();
    else if (state.tab === 'hour') renderHour();
    else if (state.tab === 'bag') renderBag();
    else if (state.tab === 'album') renderAlbum();
  }

  document.getElementById('resetbtn').onclick = reset;
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
