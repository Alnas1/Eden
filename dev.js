/* ===== EDEN 编辑页逻辑（内容只存本机 localStorage） ===== */
(function () {
  'use strict';
  var CUSTOM_KEY = '***';
  var BASE = window.EDEN_DATA || { nodes: {}, items: {}, collect: {} };

  var custom;
  try { custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null'); } catch (e) { custom = null; }
  custom = custom || {};
  custom.nodes = custom.nodes || {};
  custom.items = custom.items || {};
  custom.collect = custom.collect || {};
  custom.worlds = custom.worlds || {};

  var currentId = null;
  var $ = function (id) { return document.getElementById(id); };

  function persist() { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); }

  function nodeOf(id) { return custom.nodes[id] || BASE.nodes[id]; }
  function allIds() {
    var ids = Object.keys(BASE.nodes);
    Object.keys(custom.nodes).forEach(function (i) { if (ids.indexOf(i) < 0) ids.push(i); });
    return ids;
  }

  function renderList() {
    var box = $('nodelist'); box.innerHTML = '';
    allIds().forEach(function (id) {
      var n = nodeOf(id) || {};
      var d = document.createElement('div');
      d.className = 'nrow' + (id === currentId ? ' sel' : '');
      var mine = custom.nodes[id];
      d.innerHTML = '<span class="tag">' + (mine ? '自建' : '内置') + '</span><b>' + id + '</b> ' +
        (n.speaker || (n.text && n.text[0] ? n.text[0].slice(0, 10) : ''));
      d.onclick = function () { select(id); };
      box.appendChild(d);
    });
  }

  function lines(t) { return t.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }

  function select(id) {
    currentId = id;
    var n = nodeOf(id) || {};
    $('f_id').value = id;
    $('f_speaker').value = n.speaker || '';
    $('f_text').value = (n.text || []).join('\n');
    $('f_choices').value = (n.choices || []).map(function (c) {
      return c.t + '→' + c.to + (c.need ? '←' + c.need : '');
    }).join('\n');
    $('f_next').value = n.next || '';
    $('f_days').value = (typeof n.days === 'number') ? n.days : '';
    $('f_status').value = n.status || '';
    $('f_gain').value = (n.gain || []).join(',');
    $('f_unlock').value = (n.unlock || []).join(',');
    if ($('f_enter')) $('f_enter').value = n.enter || '';
    if ($('f_world')) $('f_world').value = n.world || '';
    if ($('f_stay')) $('f_stay').value = (typeof n.stay === 'number') ? n.stay : '';
    if ($('f_end')) $('f_end').value = n.end ? (n.endnote || 'end') : '';
    if ($('f_flags')) $('f_flags').value = Object.keys(n.flags || {}).map(function (k) { return k + '=' + n.flags[k]; }).join(',');
    if ($('f_dispatch')) {
      $('f_dispatch').value = (n.dispatch === 'phase' && n.to)
        ? Object.keys(n.to).map(function (k) { return k + ':' + n.to[k]; }).join(';')
        : '';
    }
    renderList();
  }

  function saveNode() {
    var id = $('f_id').value.trim();
    if (!id) return say('先点「新建节点」拿到一个 id');
    // 保留编辑页表单之外的字段，改文本不丢机制
    var old = nodeOf(id) || null;
    var node = old ? JSON.parse(JSON.stringify(old)) : {};
    node.speaker = $('f_speaker').value.trim();
    node.text = lines($('f_text').value);
    var chs = lines($('f_choices').value).map(function (l) {
      var nm = l.split(/←/);
      var m = nm[0].split(/→|->|>/);
      var t = (m[0] || '').trim(), c = { t: t, to: (m[1] || '').trim() };
      var nd = (nm[1] || '').trim();
      if (!nd) {
        var oc = ((old && old.choices) || []).filter(function (x) { return x.t === t; })[0];
        if (oc && oc.need) nd = oc.need;
      }
      if (nd) c.need = nd;
      return c;
    }).filter(function (c) { return c.t && c.to; });
    if (chs.length) node.choices = chs; else delete node.choices;
    if ($('f_next').value.trim()) node.next = $('f_next').value.trim(); else delete node.next;
    var dv = $('f_days').value.trim();
    if (dv !== '' && !isNaN(+dv)) node.days = +dv; else if (dv === '') delete node.days;
    if ($('f_status').value.trim()) node.status = $('f_status').value.trim();
    var g = lines($('f_gain').value.replace(/,/g, '\n')); if (g.length) node.gain = g;
    var u = lines($('f_unlock').value.replace(/,/g, '\n')); if (u.length) node.unlock = u;
    // ---- 机制字段 ----
    if ($('f_enter')) {
      var en = $('f_enter').value.trim();
      if (en) node.enter = en; else delete node.enter;
    }
    if ($('f_world')) {
      var wo = $('f_world').value.trim();
      if (wo) node.world = wo; else delete node.world;
    }
    if ($('f_stay')) {
      var st = $('f_stay').value.trim();
      if (st !== '' && !isNaN(+st)) node.stay = +st; else if (st === '') delete node.stay;
    }
    if ($('f_end')) {
      var ed = $('f_end').value.trim();
      if (ed) { node.end = 1; node.endnote = (ed === 'end') ? '' : ed; }
      else { delete node.end; delete node.endnote; }
    }
    if ($('f_flags')) {
      var fl = {};
      lines($('f_flags').value.replace(/,/g, '\n')).forEach(function (l) {
        var p = l.split('=');
        fl[p[0].trim()] = p.length > 1 ? p[1].trim() : 1;
      });
      if (Object.keys(fl).length) node.flags = fl; else delete node.flags;
    }
    if ($('f_dispatch')) {
      var dp = {};
      lines($('f_dispatch').value.replace(/;|；/g, '\n')).forEach(function (l) {
        var p = l.split(':');
        if (p.length === 2 && p[0].trim() && p[1].trim()) dp[p[0].trim()] = p[1].trim();
      });
      if (Object.keys(dp).length) { node.dispatch = 'phase'; node.to = dp; }
      else { delete node.dispatch; delete node.to; }
    }
    if (!node.text.length && !chs.length) return say('至少写一段正文或一个选项');
    custom.nodes[id] = node;
    persist(); renderList();
    say('已保存到本机：' + id + '（别忘了导出发给 AI 才算出版）');
  }

  function newNode() {
    var i = 1; while (allIds().indexOf('u' + i) >= 0) i++;
    custom.nodes['u' + i] = { text: [] };
    persist(); select('u' + i);
    say('新建了节点 u' + i + '，填好内容记得点保存');
  }

  function delNode() {
    if (!currentId) return;
    if (!custom.nodes[currentId]) return say('内置节点不能删，可以改写它');
    delete custom.nodes[currentId];
    persist(); select(allIds()[0] || '');
    say('已删除自建节点');
  }

  function tableToText(map, baseMap) {
    var merged = {}, out = [];
    Object.keys(baseMap || {}).forEach(function (k) { merged[k] = baseMap[k]; });
    Object.keys(map).forEach(function (k) { merged[k] = map[k]; });
    Object.keys(merged).forEach(function (k) {
      out.push(k + '|' + (merged[k].icon || '') + '|' + (merged[k].desc || ''));
    });
    return out.join('\n');
  }

  function textToTable(t) {
    var map = {};
    lines(t).forEach(function (l) {
      var p = l.split('|');
      if (p[0]) map[p[0].trim()] = { icon: (p[1] || '📦').trim(), desc: (p[2] || '').trim() };
    });
    return map;
  }

  function fillTables() {
    $('f_items').value = tableToText(custom.items, BASE.items);
    $('f_collect').value = tableToText(custom.collect, BASE.collect);
    if ($('f_worlds')) $('f_worlds').value = worldsToText();
  }

  function saveTables() {
    custom.items = textToTable($('f_items').value);
    custom.collect = textToTable($('f_collect').value);
    persist(); say('物品/收藏表已保存到本机');
  }

  /* ===== 世界表（切片皮肤）=====
     一行一个世界：名字|图片文件|图标题|流速下限-上限|相位:最少-最多;…|CSS变量:值;…
     流速/相位/配色留空 = 用内置值 */
  function worldsToText() {
    var merged = {}, out = [];
    Object.keys(BASE.worlds || {}).forEach(function (k) { merged[k] = Object.assign({}, BASE.worlds[k]); });
    Object.keys(custom.worlds).forEach(function (k) { merged[k] = Object.assign(merged[k] || {}, custom.worlds[k]); });
    Object.keys(merged).forEach(function (k) {
      var w = merged[k];
      var rate = (w.rate && w.rate.length === 2) ? (w.rate[0] + '-' + w.rate[1]) : '';
      var ph = Object.keys(w.phases || {}).map(function (p) { return p + ':' + (w.phases[p] || []).join('-'); }).join(';');
      var th = Object.keys(w.theme || {}).map(function (v) { return v + ':' + w.theme[v]; }).join(';');
      out.push([k, w.img || '', w.label || '', rate, ph, th].join('|'));
    });
    return out.join('\n');
  }

  function textToWorlds(t) {
    var map = {};
    lines(t).forEach(function (l) {
      var p = l.split('|');
      var name = (p[0] || '').trim(); if (!name) return;
      var w = {};
      if ((p[1] || '').trim()) w.img = p[1].trim();
      if ((p[2] || '').trim()) w.label = p[2].trim();
      var rm = (p[3] || '').trim().match(/^([\d.]+)\s*-\s*([\d.]+)$/);
      if (rm) w.rate = [parseFloat(rm[1]), parseFloat(rm[2])];
      if ((p[4] || '').trim()) {
        var ph = {};
        p[4].split(/[;；]/).forEach(function (s) {
          var m = s.split(':');
          if (m.length === 2) {
            var a = m[1].trim().split('-');
            if (a.length === 2 && !isNaN(+a[0]) && !isNaN(+a[1])) ph[m[0].trim()] = [parseInt(a[0], 10), parseInt(a[1], 10)];
          }
        });
        if (Object.keys(ph).length) w.phases = ph;
      }
      if ((p[5] || '').trim()) {
        var th = {};
        p[5].split(/[;；]/).forEach(function (s) {
          var i = s.indexOf(':');
          if (i > 0) th[s.slice(0, i).trim()] = s.slice(i + 1).trim();
        });
        if (Object.keys(th).length) w.theme = th;
      }
      map[name] = w;
    });
    return map;
  }

  function saveWorlds() {
    custom.worlds = textToWorlds($('f_worlds').value);
    persist(); say('世界表已保存到本机（只在本机生效；出版请导出全部发给 AI）');
  }

  function exportAll() {
    $('f_export').value = JSON.stringify({ nodes: custom.nodes, items: custom.items, collect: custom.collect, worlds: custom.worlds }, null, 1);
    say('已导出。把下面文本框整段复制发给 AI 即可合并进正式版。');
  }

  function importAll() {
    try {
      var j = JSON.parse($('f_export').value);
      if (j.nodes) Object.keys(j.nodes).forEach(function (k) { custom.nodes[k] = j.nodes[k]; });
      if (j.items) Object.keys(j.items).forEach(function (k) { custom.items[k] = j.items[k]; });
      if (j.collect) Object.keys(j.collect).forEach(function (k) { custom.collect[k] = j.collect[k]; });
      if (j.worlds) Object.keys(j.worlds).forEach(function (k) { custom.worlds[k] = Object.assign(custom.worlds[k] || {}, j.worlds[k]); });
      persist(); renderList(); fillTables();
      say('导入成功，已合并进本机草稿');
    } catch (e) { say('导入失败：文本框里不是合法 JSON'); }
  }

  function clearAll() {
    if (!confirm('清掉本机全部改动？（不影响正式版内置内容）')) return;
    localStorage.removeItem(CUSTOM_KEY); location.reload();
  }

  function say(m) { $('status').textContent = m; }

  $('btn_save').onclick = saveNode;
  $('btn_new').onclick = newNode;
  $('btn_del').onclick = delNode;
  $('btn_save_tables').onclick = saveTables;
  if ($('btn_save_worlds')) $('btn_save_worlds').onclick = saveWorlds;
  $('btn_export').onclick = exportAll;
  $('btn_copy').onclick = function () {
    exportAll();
    navigator.clipboard.writeText($('f_export').value).then(
      function () { say('已复制到剪贴板，直接粘贴给 AI'); },
      function () { say('复制失败，手动全选文本框内容复制吧'); });
  };
  $('btn_import').onclick = importAll;
  $('btn_clear').onclick = clearAll;

  fillTables();
  select(allIds()[0]);
})();
