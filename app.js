/* ===== EDEN 剧情引擎 v5 =====
 * v4：捏人(名字+身份卡)、切片世界(流速/三相位后台运行)、need、enter/stay/dispatch。
 * v5：每个世界独立图片+配色(themes)、收藏改「箱子」(无锁定占位，背包可移入)、
 *     删卡片 CABIN STATUS/舱室状态两行、页签行常驻 ✎编辑页 与 ∞ 入口。
 */
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
    // 世界也可被编辑页覆盖：按字段合并（只改图不必重写流速/相位）
    if (custom && custom.worlds) {
      D.worlds = D.worlds || {};
      Object.keys(custom.worlds).forEach(function (name) {
        D.worlds[name] = Object.assign({}, D.worlds[name] || {}, custom.worlds[name]);
      });
    }
    if (custom && custom.start) { D.start = custom.start; }
  } catch (e) { /* 坏数据就当没有 */ }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---- 切片：流速与相位在后台运行，永不弹窗解释 ---- */
  function newSlice(name) {
    var w = (D.worlds || {})[name] || { rate: [1, 1], phases: { '常态': [30, 30] } };
    var rate = Math.round(rnd(w.rate[0], w.rate[1]) * 100) / 100;
    var order = [], lens = {}, tot = 0;
    Object.keys(w.phases).forEach(function (p) {
      var L = Math.floor(rnd(w.phases[p][0], w.phases[p][1] + 1));
      lens[p] = L; order.push(p); tot += L;
    });
    var age = Math.floor(Math.random() * tot), acc = 0, phase = order[0], left = tot;
    for (var i = 0; i < order.length; i++) {
      var p = order[i];
      if (acc + lens[p] > age) { phase = p; left = acc + lens[p] - age; break; }
      acc += lens[p];
    }
    return { name: name, rate: rate, phase: phase, left: left, age: age, spent: 0, charged: 0 };
  }

  function loadState() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.node || !D.nodes[s.node]) {
      s = {
        pod: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        day: 0, node: D.start, feed: [], items: [], collect: [], box: [],
        flags: {}, status: '正常运行', tab: 'log',
        char: null, slice: null, world: '舰内'
      };
      applyNode(D.nodes[D.start], s);
      s.feed = [D.start];
    }
    if (!s.box) s.box = [];                       /* v5 老档迁移 */
    if (!s.world) s.world = (s.slice && s.slice.name) || '舰内';
    if (s.tab === 'album') s.tab = 'box';
    return s;
  }

  function applyNode(node, s) {
    if (!node) return;
    if (typeof node.days === 'number') s.day = node.days;
    if (node.status) s.status = node.status;
    if (node.enter && D.worlds && D.worlds[node.enter]) { s.slice = newSlice(node.enter); s.world = node.enter; }
    if (node.world) s.world = node.world;
    if (typeof node.stay === 'number') {
      if (s.slice) {
        var ch = Math.max(1, Math.round(node.stay / s.slice.rate));
        s.slice.spent = (s.slice.spent || 0) + node.stay;
        s.slice.charged = (s.slice.charged || 0) + ch;
        s.day = Math.max(0, s.day - ch);
      } else {
        s.day = Math.max(0, s.day - node.stay);
      }
    }
    (node.gain || []).forEach(function (i) { if (s.items.indexOf(i) < 0) s.items.push(i); });
    (node.unlock || []).forEach(function (c) { if (s.collect.indexOf(c) < 0) s.collect.push(c); });
    Object.keys(node.flags || {}).forEach(function (k) { s.flags[k] = node.flags[k]; });
  }

  var state = loadState();
  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  save();

  /* 文本占位符：??? 舱号；{名字} {身份} {余额} {停留} {扣减} {相位} */
  function sub(text) {
    var s = String(text).replace(/\?\?\?/g, state.pod);
    s = s.replace(/\{名字\}/g, state.char ? state.char.name : '???');
    s = s.replace(/\{身份\}/g, state.char ? state.char.rname : '???');
    s = s.replace(/\{余额\}/g, state.day);
    if (state.slice) {
      s = s.replace(/\{停留\}/g, state.slice.spent);
      s = s.replace(/\{扣减\}/g, state.slice.charged);
      s = s.replace(/\{相位\}/g, state.slice.phase);
    }
    return s;
  }

  function needOk(need) {
    if (!need) return true;
    var p = String(need).split('=');
    var v = state.flags[p[0]];
    return p.length > 1 ? String(v) === p[1] : !!v;
  }

  var $view = document.getElementById('view');
  var $tabs = document.getElementById('tabbar');

  var TABS = [
    { id: 'log', label: 'log' },
    { id: 'map', label: '地图' },
    { id: 'hour', label: '沙漏' },
    { id: 'bag', label: '背包' },
    { id: 'box', label: '箱子' }
  ];

  function renderTabs() {
    var tools = $tabs.querySelector('.tabtools');
    Array.prototype.slice.call($tabs.querySelectorAll('.tab')).forEach(function (x) { $tabs.removeChild(x); });
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tab' + (state.tab === t.id ? ' active' : '');
      b.textContent = t.label;
      b.onclick = function () { state.tab = t.id; save(); render(); };
      $tabs.insertBefore(b, tools);
    });
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function blockNode(node, enter) {
    var box = el('div', 'block' + (enter ? ' enter' : ''));
    if (node.speaker) box.appendChild(el('h2', null, esc(sub(node.speaker))));
    (node.text || []).forEach(function (p) {
      var isSys = /^[【—（]|摘要/.test(p);
      box.appendChild(el('p', isSys ? 'sys' : null, esc(sub(p))));
    });
    (node.gain || []).forEach(function (i) {
      box.appendChild(el('div', 'gain', '获得 <b>' + esc(sub(i)) + '</b>'));
    });
    return box;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* log 页：feed 常驻，点选项只追加新段落 + 换尾部按钮，整屏不重画（防闪） */
  var feedEl = null;
  var tailEl = null;

  function renderTail() {
    if (tailEl && tailEl.parentNode) tailEl.parentNode.removeChild(tailEl);
    tailEl = el('div', 'choice-list');
    var cur = D.nodes[state.node];

    if (cur && cur.end) {
      tailEl.appendChild(el('div', 'endcard',
        '<b>' + esc(cur.endnote || '第一章 · 完') + '</b><br>倒计时已经开始了，' + esc(state.pod) + ' 号。<br>' +
        '后面的章节还没有出版——你可以在 dev.html 编辑页自己写一章，<br>导出后发给 AI 合进正式版。'));
      var again = el('button', 'btn plain', '重新开始（清掉存档）');
      again.onclick = reset;
      tailEl.appendChild(again);
    } else if (cur && cur.choices && cur.choices.length) {
      var shown = cur.choices.filter(function (c) { return needOk(c.need); });
      shown.forEach(function (c) {
        var b = el('button', 'btn', esc(sub(c.t)));
        b.onclick = function () { go(c.to); };
        tailEl.appendChild(b);
      });
      if (!shown.length) {
        var w = el('button', 'btn plain', '继 续');
        w.onclick = function () { go(cur.next || state.node); };
        tailEl.appendChild(w);
      }
    } else if (cur && cur.next) {
      var cont = el('button', 'btn plain', '继 续');
      cont.onclick = function () { go(cur.next); };
      tailEl.appendChild(cont);
    } else {
      var back = el('button', 'btn plain', '回到 log');
      back.onclick = function () { state.tab = 'log'; save(); render(); };
      tailEl.appendChild(back);
    }
    $view.appendChild(tailEl);
  }

  function rebuildFeed() {
    $view.innerHTML = '';
    tailEl = null;
    feedEl = el('div');
    $view.appendChild(feedEl);
    state.feed.forEach(function (id) {
      var n = D.nodes[id];
      if (n) feedEl.appendChild(blockNode(n, false));
    });
    renderTail();
  }

  /* 相位路由：dispatch 节点本身不上屏，按当前切片相位落到对应分支 */
  function resolve(id) {
    var n = D.nodes[id], i = 0;
    while (n && n.dispatch && i < 8) {
      var key = n.dispatch === 'phase' ? (state.slice ? state.slice.phase : 'default') : 'default';
      var t = n.to && (n.to[key] || n.to['default']);
      n = t ? D.nodes[t] : null;
      i++;
    }
    return n;
  }

  function go(id) {
    var node = resolve(id);
    if (!node) { return; }
    applyNode(node, state);
    state.node = D.nodes[id] && node !== D.nodes[id] ? idOf(node) : id;
    state.feed.push(state.node);
    var wasLog = state.tab === 'log';
    state.tab = 'log';
    save();

    applyTheme();
    document.getElementById('pincabin').textContent = sub(state.status);
    renderTabs();
    if (wasLog && feedEl && feedEl.parentNode === $view) {
      feedEl.appendChild(blockNode(node, true));
      renderTail();
    } else {
      rebuildFeed();
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function idOf(node) {
    var k = Object.keys(D.nodes).filter(function (i) { return D.nodes[i] === node; });
    return k[0];
  }

  function renderMap() {
    var atShip = !state.world || state.world === '舰内';
    (D.map || []).forEach(function (m) {
      var here = atShip ? !!m.here : (m.name === state.world);
      var r = el('div', 'row' + (m.locked ? ' locked' : '') + (here ? ' here' : ''));
      r.appendChild(el('b', null, esc(sub(m.name))));
      r.appendChild(el('div', 'desc', esc(sub(m.desc || ''))));
      if (here) r.appendChild(el('div', 'desc', '（你在这里）'));
      $view.appendChild(r);
    });
    $view.appendChild(el('div', 'note', '地图随剧情解锁。想加地点，用编辑页改 map 部分。'));
  }

  function renderHour() {
    $view.appendChild(el('div', 'countdown', state.day > 0 ? state.day + ' 天' : '— —'));
    $view.appendChild(el('div', 'countdown-label', '剩余有效时间 · 舱号 EDEN/' + state.pod));
    $view.appendChild(el('div', 'quote',
      '甲方：伊甸联合体<br>乙方：{名字}<br>标的：全部剩余生命时间<br>' +
      '余额已冻结，不可充值，不可转让，不可退货。<br>处置预案：已预扣。'
      .replace(/\{名字\}/g, state.char ? state.char.name : '你')));
    if (state.flags['怀疑伊甸']) {
      $view.appendChild(el('div', 'note', '你开始留意这只 AI 的每一句「已排除故障」。'));
    }
    $view.appendChild(el('div', 'note', '天数只在剧情推进时变化——这一版先讲故事，不跑真实时间。'));
  }

  /* 背包：还带在身上、可能用得上的东西；每一行可以移入箱子 */
  function renderBag() {
    if (!state.items.length) { $view.appendChild(el('div', 'empty', '背包是空的。东西都在箱子里了。')); return; }
    state.items.forEach(function (name, i) {
      var it = D.items[name] || { icon: '📦', desc: '' };
      var r = el('div', 'row');
      r.appendChild(el('b', null, it.icon + ' ' + esc(sub(name))));
      if (it.desc) r.appendChild(el('div', 'desc', esc(sub(it.desc))));
      var mv = el('button', 'movebtn', '移入箱子');
      mv.onclick = function () {
        state.items.splice(i, 1);
        if (state.box.indexOf(name) < 0) state.box.push(name);
        save(); render();
      };
      r.appendChild(mv);
      $view.appendChild(r);
    });
  }

  /* 箱子：就是箱子。剧情收藏品自动入库，背包移入的也在这一页；不放锁定占位 */
  function renderBox() {
    var got = [];
    (state.collect || []).forEach(function (n) { if (got.indexOf(n) < 0) got.push(n); });
    (state.box || []).forEach(function (n) { if (got.indexOf(n) < 0) got.push(n); });
    if (!got.length) { $view.appendChild(el('div', 'empty', '箱子是空的。')); return; }
    got.forEach(function (name) {
      var c = (D.collect && D.collect[name]) || (D.items && D.items[name]) || { icon: '📦', desc: '' };
      var r = el('div', 'row');
      r.appendChild(el('b', null, (c.icon || '📦') + ' ' + esc(sub(name))));
      if (c.desc) r.appendChild(el('div', 'desc', esc(sub(c.desc))));
      $view.appendChild(r);
    });
  }

  function reset() {
    if (!confirm('重新开始？这会清掉本机的存档（捏人、背包、箱子、天数都归零，舱号会换一个新的）。')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  function renderHead() {
    document.getElementById('podnum').textContent = state.pod;
    document.getElementById('pincabin').textContent = sub(state.status);
    applyTheme();
    renderTabs();
  }

  /* 每个世界一套图片+配色：D.worlds[世界名] = { img, label, theme:{CSS变量} } */
  var appliedVars = [];
  function applyTheme() {
    var w = (D.worlds || {})[state.world] || {};
    var th = w.theme || {};
    appliedVars.forEach(function (k) { document.documentElement.style.removeProperty(k); });
    appliedVars = Object.keys(th);
    appliedVars.forEach(function (k) { document.documentElement.style.setProperty(k, th[k]); });
    var img = w.img || 'space.svg';
    var vi = document.getElementById('vpimg'); if (vi) vi.src = img;
    var pi = document.getElementById('pbimg'); if (pi) pi.src = img;
    var ti = document.getElementById('vptitle'); if (ti) ti.textContent = w.label || '太空舱 · 外部视野';
  }

  function render() {
    renderHead();
    if (state.tab === 'log') {
      rebuildFeed();
      window.scrollTo(0, document.body.scrollHeight);
    } else {
      feedEl = null; tailEl = null;
      $view.innerHTML = '';
      if (state.tab === 'map') renderMap();
      else if (state.tab === 'hour') renderHour();
      else if (state.tab === 'bag') renderBag();
      else if (state.tab === 'box') renderBox();
      window.scrollTo(0, 0);
    }
    onScroll();
  }

  /* 往上滑：外部视野图片滑出一半，顶部条幅就开始落下 */
  var vp = document.getElementById('viewport');
  var pin = document.getElementById('pinbanner');
  function onScroll() {
    var show = vp.getBoundingClientRect().bottom <= vp.offsetHeight * 0.5;
    pin.classList.toggle('show', show);
    document.documentElement.style.setProperty('--pinh', show ? pin.offsetHeight + 'px' : '0px');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  document.getElementById('pinreset').onclick = reset;
  document.getElementById('tabreset').onclick = reset;

  /* ===== 捏人（轻度：名字 + 一张身份卡），没登记就不醒来 ===== */
  var crt = document.getElementById('create');
  var picked = null;

  function buildCreate() {
    var roles = D.identities || [];
    var box = document.getElementById('croles');
    box.innerHTML = '';
    roles.forEach(function (r) {
      var b = el('button', 'role');
      b.innerHTML = '<b>' + esc(r.name) + '</b><span>' + esc(r.tag) + '</span><i>' + esc(r.perk) + '</i>';
      b.onclick = function () {
        picked = r;
        Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      box.appendChild(b);
    });
    document.getElementById('cok').onclick = function () {
      if (!picked) { say('先挑一张身份卡——伊甸连这个都要存档。'); return; }
      var nm = (document.getElementById('cname').value || '').trim() || ('EDEN/' + state.pod);
      state.char = { name: nm, rid: picked.id, rname: picked.name };
      state.flags['身份'] = picked.name;
      save();
      crt.parentNode.removeChild(crt);
      document.body.classList.remove('locked');
      renderHead();
      rebuildFeed();
      window.scrollTo(0, document.body.scrollHeight);
    };
    crt.hidden = false;
    document.body.classList.add('locked');
  }

  function say(m) { document.getElementById('cmsg').textContent = m; }

  if (state.char) render();
  else buildCreate();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
