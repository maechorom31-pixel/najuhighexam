/* 정시 나침반 — 화면 그리기 */
(function () {
  'use strict';

  var A = window.JeongsiApp;
  var E = window.JeongsiEngine;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    tab: 'all',
    univ: '', unit: '', minN: 0, sort: 'cut',
    zone: {}, term: {}, track: { '인문': true, '자연': true, '의약학': true, '공통': true },
    level: { '4': true, '3': true, '2': true }, mathMode: 'any',
    admit: '', maxRate: 0, gainMode: 'any', relMode: 'any',
    reqOnly: true, cutOnly: true, cartOnly: false,
    limit: 120, pristine: true,
    results: [], rp: null, cart: {}
  };

  var CART_KEY = 'jeongsi.cart.v1';
  var PROFILE_KEY = 'jeongsi.profile.v1';

  function num1to9(v, dflt) { v = +v; return (v >= 1 && v <= 9) ? Math.round(v) : dflt; }
  function bandOf(v) { return (v === 'top' || v === 'mid' || v === 'low') ? v : 'mid'; }
  function pctOf(v) {
    if (v == null || v === '') return null;
    v = +v; return (v >= 0 && v <= 100) ? Math.round(v) : null;
  }

  /** 저장된 성적을 되살린다. 값이 망가져 있어도 화면이 깨지지 않게 하나씩 검사한다. */
  function loadProfile() {
    var raw;
    try { raw = window.localStorage.getItem(PROFILE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return false; }
    if (!o || typeof o !== 'object') return false;
    var p = A.profile;
    function one(dst, src, dflt) {
      if (!src) return;
      dst.grade = num1to9(src.grade, dflt);
      dst.band = bandOf(src.band);
      dst.pct = pctOf(src.pct);
    }
    one(p.kor, o.kor, 3);
    one(p.math, o.math, 3);
    if (o.math && A.MATH_TYPES.indexOf(o.math.type) >= 0) p.math.type = o.math.type;
    p.eng.grade = num1to9(o.eng && o.eng.grade, 3);
    p.hist.grade = num1to9(o.hist && o.hist.grade, 3);
    var l2 = o.lang2 && +o.lang2.grade;
    p.lang2.grade = (l2 >= 1 && l2 <= 9) ? Math.round(l2) : 0;
    for (var i = 0; i < 2; i++) {
      var t = o.tam && o.tam[i];
      if (!t) continue;
      one(p.tam[i], t, 3);
      if (A.SATAM.indexOf(t.name) >= 0) { p.tam[i].name = t.name; p.tam[i].cat = '사탐'; }
      else if (A.GWATAM.indexOf(t.name) >= 0) { p.tam[i].name = t.name; p.tam[i].cat = '과탐'; }
    }
    return true;
  }

  function saveProfile() {
    try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(A.profile)); } catch (e) {}
    if (state.pristine) {
      state.pristine = false;
      var el = $('firsttime');
      if (el) el.parentNode.removeChild(el);
    }
  }
  function cartKey(u) { return u.univ + '|' + u.term + '|' + u.admit + '|' + u.unit + '|' + (u.major || ''); }
  function loadCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return {};
      var arr = JSON.parse(raw), o = {};
      for (var i = 0; i < arr.length; i++) o[arr[i]] = true;
      return o;
    } catch (e) { return {}; }
  }
  function saveCart() {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(Object.keys(state.cart))); } catch (e) {}
  }
  function cartCount() { return Object.keys(state.cart).length; }

  var ZONES = ['서울', '경인권', '충청권', '강원권', '전라권', '경상권', '제주권'];
  var TERMS = ['가', '나', '다'];
  var TRACKS = ['인문', '자연', '의약학', '예체능', '공통'];
  var LEVELS = [['4', '안정'], ['3', '적정'], ['2', '소신'], ['1', '도전'], ['0', '위험']];
  var MATHMODES = [['any', '전체'], ['none', '미반영'], ['opt', '미반영·선택'], ['w20', '20% 이하'], ['w30', '30% 이하']];
  var RATES = [[0, '제한 없음'], [3, '3:1 이하'], [5, '5:1 이하'], [8, '8:1 이하'], [12, '12:1 이하']];
  var GAINS = [['any', '제한 없음'], ['plus', '유리한 곳만'], ['nominus', '불리한 곳 빼기']];
  var RELS = [['any', '제한 없음'], ['2', '안정만'], ['12', '보통 이상']];
  var SORTS = [
    ['cut', '입시결과 높은 순'],
    ['diff', '내 성적과 가까운 순'],
    ['gain', '반영 유불리 유리한 순'],
    ['mathlow', '수학 비중 낮은 순'],
    ['korhigh', '국어 비중 높은 순'],
    ['enghigh', '영어 비중 높은 순'],
    ['tamhigh', '탐구 비중 높은 순'],
    ['n', '모집인원 많은 순'],
    ['rate', '경쟁률 낮은 순']
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function f1(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1); }
  function sgn(v) {
    if (v == null) return '–';
    if (Math.abs(v) < 0.05) return '0.0';      // +0.0 / -0.0 은 어색하다
    return (v > 0 ? '+' : '') + f1(v);
  }
  /* 마지막 어절이 짧으면 앞 어절에 붙여 고아줄을 막는다 */
  function tie(s) { return String(s || '').replace(/ (?=[^ ]{1,4}$)/, ' '); }

  /* ------------------------------------------------------------ 성적 입력 */

  function gradeOpts(sel) {
    var h = '';
    for (var g = 1; g <= 9; g++) h += '<option value="' + g + '"' + (g === sel ? ' selected' : '') + '>' + g + '등급</option>';
    return h;
  }
  function bandOpts(sel) {
    return [['top', '상위'], ['mid', '중간'], ['low', '하위']].map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
  }
  function listOpts(arr, sel) {
    return arr.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('');
  }

  function renderScores() {
    var p = A.profile, usePct = $('usePct').checked;

    /* 모든 칸을 '과목 줄 + 성적 줄' 두 단으로 맞춰, 아래 설명 줄의 기준선을 나란히 둔다. */
    function field(id, label, top, item) {
      var body;
      if (usePct) {
        body = '<input type="number" min="0" max="100" id="' + id + '-pct" value="' +
               (item.pct == null ? '' : item.pct) + '" placeholder="백분위 0~100" />';
      } else {
        body = '<div class="duo"><select id="' + id + '-g" aria-label="' + esc(label) + ' 등급">' +
               gradeOpts(item.grade) + '</select>' +
               '<select id="' + id + '-b" aria-label="' + esc(label) + ' 등급 내 위치">' +
               bandOpts(item.band) + '</select></div>';
      }
      return '<div class="field"><label for="' + id + (usePct ? '-pct' : '-g') + '">' + label + '</label>' +
             '<div class="ctl">' + top + body + '</div>' +
             '<div class="hint" id="' + id + '-hint"></div></div>';
    }
    function fixedField(id, label, top, grade, hint) {
      return '<div class="field"><label for="' + id + '">' + label + '</label><div class="ctl">' + top +
             '<select id="' + id + '">' + gradeOpts(grade) + '</select></div>' +
             '<div class="hint">' + hint + '</div></div>';
    }
    function tamOpts(sel) {
      function grp(name, arr) {
        return '<optgroup label="' + name + '">' + arr.map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</optgroup>';
      }
      return grp('사회탐구', A.SATAM) + grp('과학탐구', A.GWATAM);
    }

    var h = '';
    h += field('kor', '국어', '<div class="staticline">공통 · 선택과목 무관</div>', p.kor);
    h += field('math', '수학',
               '<select id="math-t" aria-label="수학 선택과목">' + listOpts(A.MATH_TYPES, p.math.type) + '</select>',
               p.math);
    for (var i = 0; i < 2; i++) {
      h += field('tam' + i, '탐구 ' + (i + 1),
                 '<select id="tam' + i + '-n" aria-label="탐구 ' + (i + 1) + ' 과목">' + tamOpts(p.tam[i].name) + '</select>',
                 p.tam[i]);
    }
    h += fixedField('eng-g', '영어', '<div class="staticline">절대평가 · 등급만 반영</div>', p.eng.grade,
                    '등급별 배점은 대학 자료 그대로 씁니다.');
    h += fixedField('hist-g', '한국사', '<div class="staticline">절대평가 · 등급만 반영</div>', p.hist.grade,
                    '가산·감점 방식까지 반영합니다.');
    h += '<div class="field"><label for="l2-g">제2외국어·한문</label><div class="ctl">' +
         '<div class="staticline">일부 대학은 탐구를 대체</div>' +
         '<select id="l2-g"><option value="0"' + (p.lang2.grade === 0 ? ' selected' : '') + '>미응시</option>' +
         gradeOpts(p.lang2.grade) + '</select></div>' +
         '<div class="hint">응시했다면 등급을 골라 주세요.</div></div>';

    $('scores').innerHTML = h;
    bindScores();
    updateHints();
  }

  function bindScores() {
    var usePct = $('usePct').checked, p = A.profile;
    function bind(id, item) {
      if (usePct) {
        $(id + '-pct').addEventListener('input', function () {
          var v = parseInt(this.value, 10);
          item.pct = isNaN(v) ? null : Math.max(0, Math.min(100, v));
          schedule();
        });
      } else {
        $(id + '-g').addEventListener('change', function () { item.grade = +this.value; item.pct = null; schedule(); });
        $(id + '-b').addEventListener('change', function () { item.band = this.value; item.pct = null; schedule(); });
      }
    }
    bind('kor', p.kor);
    bind('math', p.math);
    $('math-t').addEventListener('change', function () { p.math.type = this.value; schedule(); });
    $('eng-g').addEventListener('change', function () { p.eng.grade = +this.value; schedule(); });
    $('hist-g').addEventListener('change', function () { p.hist.grade = +this.value; schedule(); });
    $('l2-g').addEventListener('change', function () { p.lang2.grade = +this.value; schedule(); });
    for (var i = 0; i < 2; i++) {
      (function (i) {
        bind('tam' + i, p.tam[i]);
        $('tam' + i + '-n').addEventListener('change', function () {
          p.tam[i].name = this.value;
          p.tam[i].cat = A.GWATAM.indexOf(this.value) >= 0 ? '과탐' : '사탐';
          schedule();
        });
      })(i);
    }
  }

  function updateHints() {
    var rp = state.rp;
    if (!rp) return;
    function set(id, o) {
      var el = $(id + '-hint');
      if (el) el.textContent = '백분위 ' + o.pct + ' · 표준점수 ' + o.std + ' · ' + o.grade + '등급';
    }
    set('kor', rp.kor); set('math', rp.math); set('tam0', rp.tam[0]); set('tam1', rp.tam[1]);
  }

  function renderSummary() {
    var rp = state.rp, fit = 0, byTerm = { '가': 0, '나': 0, '다': 0 };
    for (var i = 0; i < state.results.length; i++) {
      var r = state.results[i];
      if (r.level >= 2 && r.req.ok && r.u.track !== '예체능') {
        fit++;
        if (byTerm[r.u.term] != null) byTerm[r.u.term]++;
      }
    }
    var avgG = (rp.kor.grade + rp.math.grade + rp.tam[0].grade + rp.tam[1].grade) / 4;
    $('summary').innerHTML =
      item('기준 백분위 <span style="font-weight:400">국수탐(2) 평균</span>', f1(rp.basePct)) +
      item('국·수·탐 평균 등급', f1(avgG) + '<small> 등급</small>') +
      item('소신 이상으로 나온 곳', fit.toLocaleString() + '<small> 곳</small>') +
      item('군별 소신 이상', '가 ' + byTerm['가'] + '<small> · </small>나 ' + byTerm['나'] +
                            '<small> · </small>다 ' + byTerm['다']);
    function item(t, v) { return '<div><dt>' + t + '</dt><dd class="num">' + v + '</dd></div>'; }
  }

  /* ------------------------------------------------- 내 위치 지도 */

  var BIN = 5;   // 백분위 5점 구간

  function renderCompass() {
    var rp = state.rp, bins = [], i;
    for (i = 0; i < 100 / BIN; i++) bins.push(0);
    var withCut = 0, reach = 0;
    for (i = 0; i < state.results.length; i++) {
      var r = state.results[i];
      if (r.cut70p == null || r.u.track === '예체능' || !r.req.ok) continue;
      withCut++;
      bins[Math.min(bins.length - 1, Math.floor(r.cut70p / BIN))]++;
      if (r.level >= 2) reach++;
    }
    if (!withCut) { $('compass').innerHTML = ''; return; }

    // 막대와 기준선만 SVG로 그린다. 글자를 SVG에 넣으면 가로로 늘릴 때 함께 찌그러진다.
    var W = 1000, H = 100, maxV = Math.max.apply(null, bins);
    var barW = W / bins.length, gap = 3, x0 = rp.basePct / 100 * W;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" ' +
      'aria-label="2025학년도 70%컷 백분위 분포. 기준 백분위 ' + f1(rp.basePct) +
      ' 이하 구간에 ' + reach + '곳이 있습니다.">';
    for (i = 0; i < bins.length; i++) {
      var hgt = maxV ? (H - 2) * bins[i] / maxV : 0;
      var lo = i * BIN;
      svg += '<rect x="' + (i * barW + gap / 2).toFixed(1) + '" y="' + (H - Math.max(hgt, bins[i] ? 1.5 : 0)).toFixed(1) +
        '" width="' + (barW - gap).toFixed(1) + '" height="' + Math.max(hgt, bins[i] ? 1.5 : 0).toFixed(1) +
        '" fill="' + (lo + BIN <= rp.basePct + 0.5 ? '#F59E0B' : '#DDD9D2') + '">' +
        '<title>백분위 ' + lo + '~' + (lo + BIN) + ' · 모집단위 ' + bins[i].toLocaleString() + '곳</title></rect>';
    }
    svg += '<line x1="' + x0.toFixed(1) + '" y1="0" x2="' + x0.toFixed(1) +
      '" y2="' + H + '" stroke="#B45309" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>';

    var side = rp.basePct > 70 ? 'right:' + (100 - rp.basePct).toFixed(1) + '%' : 'left:' + rp.basePct.toFixed(1) + '%';
    var ticks = [0, 20, 40, 60, 80, 100].map(function (t) {
      return '<span style="left:' + t + '%">' + t + '</span>';
    }).join('');

    $('compass').innerHTML =
      '<figure class="compass" style="margin:0">' +
      '<h3>전국 정시 지형에서 내 위치</h3>' +
      '<p class="lede" style="font-size:12.5px">2025학년도 70%컷 백분위로 본 모집단위 분포입니다. ' +
        '지정과목을 채우는 곳만 세었고 예체능은 뺐습니다.</p>' +
      '<p class="hero">' + reach.toLocaleString() + '곳 <span style="font-size:13px;font-weight:400;color:#6B6B6B">' +
        '· 입시결과가 있는 ' + withCut.toLocaleString() + '곳의 ' + Math.round(reach / withCut * 100) + '%</span></p>' +
      '<p class="heroSub">기준 백분위 <span class="num">' + f1(rp.basePct) + '</span>' + josaRo(f1(rp.basePct)) +
        ' 소신 이상이 나오는 모집단위 수입니다. 앰버로 채운 구간이 내 기준 백분위 아래, 회색이 위입니다.</p>' +
      '<div class="plot"><div class="mine" style="' + side + '">내 ' + f1(rp.basePct) + '</div>' + svg +
      '<div class="ticks">' + ticks + '</div></div>' +
      '<figcaption>가로축 = 2025학년도 70%컷 백분위 · 세로축 = 모집단위 수 · 막대에 손을 올리면 구간별 개수가 보입니다.</figcaption>' +
      '</figure>';
  }

  /* -------------------------------------------------------------- 필터 UI */

  function renderFilters() {
    $('f-min').innerHTML = [0, 5, 10, 20, 30, 50].map(function (v) {
      return '<option value="' + v + '"' + (v === state.minN ? ' selected' : '') + '>' +
             (v === 0 ? '제한 없음' : v + '명 이상') + '</option>';
    }).join('');
    $('f-rate').innerHTML = RATES.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === state.maxRate ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    $('f-gain').innerHTML = GAINS.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === state.gainMode ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    $('f-rel').innerHTML = RELS.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === state.relMode ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    $('f-sort').innerHTML = SORTS.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === state.sort ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
    chips('chip-zone', '권역', ZONES, state.zone);
    chips('chip-term', '군', TERMS.map(function (t) { return t + '군'; }), state.term, TERMS);
    chips('chip-track', '계열', TRACKS, state.track);
    chips('chip-level', '판정', LEVELS.map(function (l) { return l[1]; }), state.level, LEVELS.map(function (l) { return l[0]; }));
    mathChips();
  }

  function chips(boxId, label, labels, store, values) {
    values = values || labels;
    var h = '<span class="lab">' + label + '</span>';
    for (var i = 0; i < labels.length; i++) {
      h += '<button type="button" class="chip" data-box="' + boxId + '" data-v="' + esc(values[i]) +
           '" aria-pressed="' + (store[values[i]] ? 'true' : 'false') + '">' + esc(labels[i]) + '</button>';
    }
    $(boxId).innerHTML = h;
    var btns = $(boxId).querySelectorAll('.chip');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        var v = this.getAttribute('data-v');
        if (store[v]) delete store[v]; else store[v] = true;
        this.setAttribute('aria-pressed', store[v] ? 'true' : 'false');
        state.limit = 120; draw();
      });
    }
  }

  function mathChips() {
    // 수학 탭에서는 '전체'를 고를 수 없다. 탭 이름과 필터가 어긋나지 않게 한다.
    var modes = state.tab === 'math'
      ? MATHMODES.filter(function (m) { return m[0] !== 'any'; })
      : MATHMODES;
    var h = '<span class="lab">수학 반영</span>';
    for (var i = 0; i < modes.length; i++) {
      h += '<button type="button" class="chip" data-v="' + modes[i][0] + '" aria-pressed="' +
           (state.mathMode === modes[i][0] ? 'true' : 'false') + '">' + modes[i][1] + '</button>';
    }
    $('chip-math').innerHTML = h;
    var btns = $('chip-math').querySelectorAll('.chip');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        state.mathMode = this.getAttribute('data-v');
        mathChips(); state.limit = 120; draw();
      });
    }
  }

  /* ------------------------------------------------------------- 걸러내기 */

  function anySelected(o) { for (var k in o) if (o.hasOwnProperty(k)) return true; return false; }

  function filtered() {
    var out = [], q1 = state.univ.trim(), q2 = state.unit.trim(), q3 = state.admit.trim();
    var useZone = anySelected(state.zone), useTerm = anySelected(state.term),
        useTrack = anySelected(state.track), useLevel = anySelected(state.level);
    for (var i = 0; i < state.results.length; i++) {
      var r = state.results[i], u = r.u;
      if (state.cutOnly && r.cut70p == null) continue;
      if (state.reqOnly && !r.req.ok) continue;
      if (useZone && !state.zone[u.zone]) continue;
      if (useTerm && !state.term[u.term]) continue;
      if (useTrack && !state.track[u.track]) continue;
      if (useLevel && !state.level[String(r.level)]) continue;
      if (state.minN && (u.n26 || 0) < state.minN) continue;
      if (q1 && u.univ.indexOf(q1) < 0) continue;
      if (q2 && (u.unit + ' ' + (u.major || '')).indexOf(q2) < 0) continue;
      if (q3 && (u.admit || '').indexOf(q3) < 0) continue;
      if (state.cartOnly && !state.cart[cartKey(u)]) continue;
      if (state.maxRate) {
        var rate = u.compete && u.compete[0];
        if (rate == null || rate > state.maxRate) continue;
      }
      if (state.relMode !== 'any' && state.relMode.indexOf(String(r.rel.level)) < 0) continue;
      if (state.gainMode === 'plus' && !(r.gain != null && r.gain >= 1.5)) continue;
      if (state.gainMode === 'nominus' && r.gain != null && r.gain <= -1.5) continue;
      if (state.mathMode !== 'any') {
        var m = state.mathMode;
        if (m === 'none' && r.math.role !== '미반영') continue;
        if (m === 'opt' && r.math.role === '필수') continue;
        if (m === 'w20' && !(r.math.role !== '필수' || r.math.max <= 20)) continue;
        if (m === 'w30' && !(r.math.role !== '필수' || r.math.max <= 30)) continue;
      }
      out.push(r);
    }
    return sortRows(out);
  }

  function sortRows(rows) {
    var s = state.sort;
    var key = {
      diff: function (r) { return r.diff == null ? -999 : -Math.abs(r.diff); },
      gain: function (r) { return r.gain == null ? -999 : r.gain; },
      cut: function (r) { return r.cut70p == null ? -1 : r.cut70p; },
      mathlow: function (r) { return -(r.math.role === '미반영' ? -1 : r.math.max); },
      korhigh: function (r) { return r.wUsed['국'] || 0; },
      enghigh: function (r) { return r.wUsed['영'] || 0; },
      tamhigh: function (r) { return r.wUsed['탐'] || 0; },
      n: function (r) { return r.u.n26 || 0; },
      rate: function (r) { return -(r.u.compete && r.u.compete[0] != null ? r.u.compete[0] : 999); }
    }[s] || function (r) { return r.diff == null ? -999 : r.diff; };
    return rows.sort(function (a, b) {
      var d = key(b) - key(a);
      if (d) return d;
      d = (b.cut70p || 0) - (a.cut70p || 0);
      return d || a.u.univ.localeCompare(b.u.univ, 'ko');
    });
  }

  /* --------------------------------------------------------------- 그리기 */

  function gauge(level) {
    var h = '<span class="gauge" aria-hidden="true">';
    for (var i = 0; i < 5; i++) h += '<i class="' + (level >= 0 && i <= level ? 'on' : '') + '"></i>';
    return h + '</span>';
  }
  function levelCell(r) {
    if (r.level < 0) return '<span class="lv-name" style="color:#6B6B6B">자료 없음</span>';
    return '<span class="lv' + r.level + '">' + gauge(r.level) +
           '<span class="lv-name">' + A.LEVEL_NAME[r.level] + '</span></span>';
  }
  /** 경쟁률은 추가합격을 빼고 봐야 실제 문턱이 보인다. */
  function rateCell(r) {
    var c = r.u.compete || [];
    if (c[0] == null) return '–';
    if (c[2] == null) return '<span class="num">' + f1(c[0]) + '</span>';
    // 두 줄로 나눠야 열이 좁아져 표가 화면 안에 들어온다
    return '<span class="num">' + f1(c[0]) +
           '<br><span style="color:#6B6B6B">(' + f1(c[2]) + ')</span></span>';
  }

  function gainCell(r) {
    if (r.gain == null) return '–';
    if (r.gain >= 1.5) return '<span class="tag">유리 ' + sgn(r.gain) + '</span>';
    if (r.gain <= -1.5) return '<span class="tag plain">불리 ' + sgn(r.gain) + '</span>';
    return '<span class="num">' + sgn(r.gain) + '</span>';
  }

  var BOOKMARK = '<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1.5 1.5h9v13l-4.5-3.6-4.5 3.6z"/></svg>';
  var REL_NAME = ['주의', '보통', '안정'];

  /** 모집인원 옆에 입시결과 신뢰도를 세 칸 게이지로 붙인다. */
  function seatCell(r) {
    var n = r.u.n26, lv = r.rel.level, i, g = '';
    for (i = 0; i < 3; i++) g += '<i class="' + (i <= lv ? 'on' : '') + '"></i>';
    return '<span class="num">' + (n == null ? '–' : n) + '</span>' +
           '<span class="relg" title="입시결과 신뢰도 ' + REL_NAME[lv] + ' (' + r.rel.score + '점)' +
           (r.rel.why.length ? ' · ' + r.rel.why.join(' · ') : '') + '" aria-label="신뢰도 ' +
           REL_NAME[lv] + '">' + g + '</span>';
  }

  function relText(r) {
    var t = '<b>' + REL_NAME[r.rel.level] + '</b> (' + r.rel.score + '점)';
    if (!r.rel.why.length) return t + ' — 깎을 만한 자리가 없습니다.';
    return t + '<br><span style="color:#2B2B2B">· ' + r.rel.why.map(esc).join('<br>· ') + '</span>';
  }

  /** 군이 바뀌면 지원자 풀이 통째로 달라진다. */
  function moveText(u) {
    var m = u.move, names = ['가', '나', '다'], out = [], big = [];
    for (var i = 0; i < 3; i++) {
      if (m.y26[i] == null && m.y25[i] == null) continue;
      var d = m.diff[i] || 0;
      out.push(names[i] + '군 ' + (m.y26[i] || 0) + '명' +
               (d ? ' <span style="color:#6B6B6B">(' + (d > 0 ? '+' : '') + d + ')</span>' : ''));
      if (Math.abs(d) >= 50) big.push(names[i] + '군 ' + (d > 0 ? '+' : '') + d + '명');
    }
    var t = out.join(' · ');
    if (big.length) {
      t += '<br><span class="warn">' + esc(big.join(', ')) +
           ' — 군이 크게 옮겨 가 지원자 구성이 달라집니다.</span>';
    }
    return t;
  }

  function keepCell(r) {
    var on = !!state.cart[cartKey(r.u)];
    return '<button type="button" class="keep" data-k="' + esc(cartKey(r.u)) + '" aria-pressed="' +
           (on ? 'true' : 'false') + '" title="' + (on ? '관심 목록에서 빼기' : '관심 목록에 담기') +
           '" aria-label="' + esc(r.u.univ + ' ' + r.u.unit) + (on ? ' 관심 목록에서 빼기' : ' 관심 목록에 담기') +
           '">' + BOOKMARK + '</button>';
  }

  /* 반영비율 한 칸. 이 성적에 실제로 적용된 값을 보이고,
     골라서 반영하는 영역은 별표로 구분한다. */
  function ratioCell(r, area) {
    var role = r.roles ? r.roles[area] : null, used = r.wUsed[area];
    if (!role || role.role === '미반영') {
      return '<span style="color:#6B6B6B">–</span>';
    }
    if (role.role === '선택') {
      if (used) {
        return '<span class="num">' + f1(used) + '<span class="opt">*</span></span>';
      }
      // 배점 0은 뽑히지 않았다는 뜻이다.
      return '<span class="num" style="color:#6B6B6B" title="골라서 반영하는 영역 · 최대 ' +
             f1(role.max) + '%. 이 성적에서는 빠졌습니다.">–<span class="opt">*</span></span>';
    }
    var v = used != null ? used : role.max;
    if (!v) return '<span style="color:#6B6B6B">–</span>';
    return '<span class="num">' + f1(v) + '</span>';
  }

  /** 한국사·제2외국어는 자리를 많이 차지하지 않게 한 칸으로 묶는다. */
  function etcCell(r) {
    var v = (r.wUsed['한'] || 0) + (r.wUsed['외'] || 0);
    if (!v) return '<span style="color:#6B6B6B">–</span>';
    var what = [];
    if (r.wUsed['한']) what.push('한국사 ' + f1(r.wUsed['한']) + '%');
    if (r.wUsed['외']) what.push('제2외국어 ' + f1(r.wUsed['외']) + '%');
    return '<span class="num" title="' + esc(what.join(' · ')) + '">' + f1(v) + '</span>';
  }

  /* 좁은 화면에서는 오른쪽 열이 화면 밖으로 밀린다.
     이름 아래에 컷·판정·유불리를 한 줄로 붙여 스크롤 없이도 가늠하게 한다. */
  function miniLine(r) {
    var bits = ['컷 ' + f1(r.cut70p), sgn(r.diff)];
    if (r.level >= 0) bits.push(A.LEVEL_NAME[r.level]);
    if (r.gain >= 1.5) bits.push('유리 ' + sgn(r.gain));
    else if (r.gain <= -1.5) bits.push('불리 ' + sgn(r.gain));
    return '<span class="mini">' + esc(bits.join(' · ')) + '</span>';
  }

  function ratioCells(r) {
    return '<td class="n rt">' + ratioCell(r, '국') + '</td>' +
           '<td class="n rt">' + ratioCell(r, '수') + '</td>' +
           '<td class="n rt">' + ratioCell(r, '영') + '</td>' +
           '<td class="n rt">' + ratioCell(r, '탐') + '</td>' +
           '<td class="n rt fold">' + etcCell(r) + '</td>';
  }

  /** 기본값에서 손댄 조건만 늘어놓는다. 빈 결과의 원인을 바로 짚게 하려는 것이다. */
  function changedFilterText() {
    var on = [];
    if (state.univ.trim()) on.push('대학 이름 "' + state.univ.trim() + '"');
    if (state.unit.trim()) on.push('모집단위 "' + state.unit.trim() + '"');
    if (state.admit.trim()) on.push('전형 "' + state.admit.trim() + '"');
    var z = Object.keys(state.zone); if (z.length) on.push('권역 ' + z.join('·'));
    var t = Object.keys(state.term); if (t.length) on.push('군 ' + t.join('·'));
    var k = Object.keys(state.track).sort();
    if (k.join('·') !== '공통·의약학·인문·자연') {          // 기본값과 다를 때만
      on.push(k.length ? '계열 ' + k.join('·') : '계열 아무것도 안 켜짐');
    }
    var l = Object.keys(state.level).sort();
    if (l.join('·') !== ['2', '3', '4'].join('·')) {
      on.push(l.length ? '가능성 ' + l.slice().reverse().map(function (x) { return A.LEVEL_NAME[+x]; }).join('·')
                       : '가능성 아무것도 안 켜짐');
    }
    if (state.minN) on.push('모집인원 ' + state.minN + '명 이상');
    if (state.maxRate) on.push('경쟁률 ' + state.maxRate + ':1 이하');
    if (state.gainMode !== 'any') on.push('반영 유불리 제한');
    if (state.relMode !== 'any') on.push('입시결과 신뢰도 제한');
    if (state.mathMode !== 'any') on.push('수학 반영 제한');
    if (state.cartOnly) on.push('관심 목록에 담은 곳만');
    if (!state.reqOnly) on.push('지정과목 조건 해제');
    if (!state.cutOnly) on.push('입시결과 없는 곳 포함');
    return on;
  }

  function emptyReason() {
    var ch = changedFilterText();
    if (ch.length) return '좁혀 둔 조건 — ' + esc(ch.join(' · '));
    return '기본 조건(가능성 소신 이상 · 지정과목을 채우는 곳 · 입시결과가 있는 곳)만으로도 남는 곳이 없습니다. ' +
           '목표 등급을 올려 보거나, 가능성 칩에서 도전·위험을 함께 켜 보세요.';
  }

  function drawTable(rows) {
    if (!rows.length) {
      $('view').innerHTML = '<div class="tablewrap"><div class="empty">' +
        '<p style="margin:0 0 4px">조건에 맞는 모집단위가 없습니다.</p>' +
        '<p style="margin:0 0 16px;font-size:13px">' + emptyReason() + '</p>' +
        '<button type="button" class="btn noprint" id="empty-reset">조건 초기화</button></div></div>';
      $('empty-reset').addEventListener('click', resetFilters);
      return;
    }
    var shown = rows.slice(0, state.limit);
    var h = '<div class="tablewrap"><table><thead><tr>' +
      '<th>군</th><th>대학</th><th>모집단위</th><th class="nw fold">계열</th>' +
      '<th class="n">모집<br>·신뢰도</th><th class="n">2025<br>70%컷</th><th class="n">내 기준<br>대비</th>' +
      '<th>가능성</th><th class="n">반영<br>유불리</th>' +
      '<th class="n rt">국어</th><th class="n rt">수학</th><th class="n rt">영어</th><th class="n rt">탐구</th>' +
      '<th class="n rt fold">기타</th><th class="n fold">경쟁률<br>(실질)</th><th>관심</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < shown.length; i++) {
      var r = shown[i], u = r.u;
      h += '<tr class="main"><td>' + esc(u.term) + '</td>' +
        '<td class="uni">' + esc(u.univ) + '</td>' +
        '<td class="major"><button type="button" class="rowbtn" data-i="' + i + '">' +
          esc(tie(u.unit)) +
          (u.dupAdmit ? ' <span class="tag plain">' + esc(u.admit) + '</span>' : '') +
          (u.major ? ' <span class="tag plain">세부</span>' : '') +
          (!r.req.ok ? ' <span class="warn">지정과목 확인</span>' : '') +
          miniLine(r) + '</button></td>' +
        '<td class="nw fold">' + esc(u.track) + '</td>' +
        '<td class="n">' + seatCell(r) + '</td>' +
        '<td class="n">' + f1(r.cut70p) + '</td>' +
        '<td class="n">' + sgn(r.diff) + '</td>' +
        '<td>' + levelCell(r) + '</td>' +
        '<td class="n">' + gainCell(r) + '</td>' + ratioCells(r) +
        '<td class="n fold">' + rateCell(r) + '</td>' +
        '<td class="noprint">' + keepCell(r) + '</td></tr>';
      h += '<tr class="det" id="det-' + i + '" hidden><td colspan="16">' + detail(r) + '</td></tr>';
    }
    h += '</tbody></table></div>';
    if (rows.length > state.limit) {
      h += '<div class="more noprint"><button type="button" class="btn" id="more">' +
           '더 보기 (' + shown.length.toLocaleString() + ' / ' + rows.length.toLocaleString() + ')</button></div>';
    }
    h += '<p class="note"><strong>국어·수학·영어·탐구</strong> 칸은 이 성적에 실제로 적용된 반영비율(%)입니다. ' +
         '<span class="opt">*</span>는 대학이 골라서 반영하는 영역이라는 뜻으로, ' +
         '<span class="opt">*</span>가 붙은 <span style="color:#6B6B6B">–</span>는 더 잘한 영역이 대신 들어가 빠졌다는 표시입니다. ' +
         '<span style="color:#6B6B6B">–</span>만 있으면 그 대학이 아예 반영하지 않습니다. ' +
         '<strong>기타</strong>는 한국사와 제2외국어를 합한 값이라, 다섯 칸을 더하면 100%가 됩니다. ' +
         '(원자료 표기가 어긋나 합이 맞지 않는 곳은 상세에 알려 드립니다.)</p>';
    h += '<p class="note"><strong>내 기준 대비</strong>는 기준 백분위 <span class="num">' + f1(state.rp.basePct) +
         '</span>에서 그 모집단위의 2025년 70%컷을 뺀 값입니다. ' +
         '<strong>반영 유불리</strong>는 그 대학의 반영 영역·비율·활용지표를 그대로 적용했을 때 ' +
         '같은 백분위대의 학생들보다 얼마나 앞서거나 뒤지는지를 백분위 눈금으로 나타낸 값입니다. ' +
         '가능성 판정에는 더하지 않았습니다 — 공개된 컷 자체가 이미 그 방식으로 뽑은 결과라 이중으로 셈하게 되기 때문입니다.</p>';
    $('view').innerHTML = h;

    var btns = $('view').querySelectorAll('.rowbtn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        var row = $('det-' + this.getAttribute('data-i'));
        row.hidden = !row.hidden;
      });
    }
    bindKeep($('view'));
    if ($('more')) $('more').addEventListener('click', function () { state.limit += 120; draw(); });
  }

  function bindKeep(root) {
    var bs = root.querySelectorAll('.keep');
    for (var i = 0; i < bs.length; i++) {
      bs[i].addEventListener('click', function () {
        var k = this.getAttribute('data-k');
        if (state.cart[k]) delete state.cart[k]; else state.cart[k] = true;
        saveCart();
        this.setAttribute('aria-pressed', state.cart[k] ? 'true' : 'false');
        this.setAttribute('title', state.cart[k] ? '관심 목록에서 빼기' : '관심 목록에 담기');
        renderCartCount();
        if (state.tab === 'cart' || state.cartOnly) draw();
      });
    }
  }

  function renderCartCount() {
    var n = cartCount();
    $('cart-n').textContent = n ? ' ' + n : '';
  }

  var AREA_NAME = { '국': '국어', '수': '수학', '영': '영어', '탐': '탐구', '한': '한국사', '외': '제2외국어' };

  /** 앞 낱말의 받침에 맞춰 조사를 고른다. '을/를', '이/가', '은/는', '와/과'. */
  function josa(word, pair) {
    var w = String(word || '').replace(/[)\]}>"']+$/, '');
    var ch = w.charAt(w.length - 1), code = ch.charCodeAt(0), batchim;
    if (code >= 0xAC00 && code <= 0xD7A3) batchim = (code - 0xAC00) % 28 !== 0;
    else if (ch >= '0' && ch <= '9') batchim = '013678'.indexOf(ch) >= 0;
    else if (ch === '%') batchim = true;              // 퍼센트
    else batchim = true;
    var p = pair.split('/');
    return batchim ? p[0] : p[1];
  }
  /** '(으)로'는 받침이 없거나 ㄹ 받침이면 '로'를 쓴다. */
  function josaRo(word) {
    var w = String(word || '').replace(/[)\]}>"']+$/, '');
    var ch = w.charAt(w.length - 1), code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      var t = (code - 0xAC00) % 28;
      return (t === 0 || t === 8) ? '로' : '으로';    // 8 = ㄹ 받침
    }
    if (ch >= '0' && ch <= '9') return '1245789'.indexOf(ch) >= 0 ? '로' : '으로';
    if (ch === '%') return '로';                        // 퍼센트
    return '으로';
  }

  /** 반영영역 표기를 사람 말로 푼다. '택2(국수영)+탐1한' → '국어·수학·영어 중 잘한 2개 + 탐구 1과목 + 한국사' */
  function areasInWords(u) {
    var terms = E.parsePattern(u.areas, u.tCnt);
    if (!terms) return '';
    var out = [];
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (t.kind === 'rest') { out.push('앞에서 안 쓴 영역 중 잘한 ' + t.n + '개'); continue; }
      var names = t.areas.map(function (a) {
        if (a.indexOf('탐@') === 0) return '탐구 ' + a.slice(2) + '과목';
        if (a.indexOf('탐#') === 0) return '탐구 ' + a.slice(2) + '번 과목';
        return AREA_NAME[a] || a;
      });
      if (t.kind === 'fix') out.push(names.join('·'));
      else out.push(names.join('·') + ' 중 잘한 ' + t.n + '개' + (t.avg ? '의 평균' : ''));
    }
    return out.join(' + ');
  }

  /** 이 성적에 왜 이런 결과가 나왔는지 설명한다. */
  function explain(r) {
    var u = r.u, W = r.wUsed, rp = state.rp, lines = [];

    var words = areasInWords(u);
    if (words) {
      lines.push('이 모집단위는 <b>' + esc(words) + '</b>' + josa(words, '을/를') + ' 반영합니다.');
    } else if (u.areas || u.memo) {
      lines.push('이 모집단위의 반영 방법은 <b>' + esc(u.areas || u.memo) + '</b>입니다. ' +
                 '표기가 자동 해석되지 않아, 아래 비율은 어림값입니다.');
    }

    // 실제로 어떤 영역이 뽑혔는지
    var picked = [], dropped = [], ORDER = ['국', '수', '영', '탐', '한', '외'];
    ORDER.forEach(function (a) {
      if (W[a]) picked.push(AREA_NAME[a] + ' ' + f1(W[a]) + '%');
      else if (u.w[ORDER.indexOf(a)]) dropped.push(AREA_NAME[a]);
    });
    if (picked.length) {
      var sent = '이 성적에서는 <b>' + esc(picked.join(', ')) + '</b>로 잡혔습니다';
      if (dropped.length) {
        var d = dropped.join('·');
        sent += '. ' + esc(d) + josa(d, '은/는') + ' 빠졌습니다';
      }
      lines.push(sent + '.');
    }

    // 수학 부담
    var mr = r.math;
    if (mr.role === '미반영') {
      lines.push('<b>수학을 아예 반영하지 않습니다.</b> 수학 성적은 결과에 들어가지 않습니다.');
    } else if (mr.role === '선택' && !W['수']) {
      lines.push('<b>수학은 골라서 반영하는 영역이라 이 성적에서는 빠졌습니다.</b> ' +
                 '더 잘한 영역이 대신 들어갔기 때문입니다. 수학 부담이 낮은 이유가 여기 있습니다.');
    } else if (mr.role === '선택') {
      lines.push('수학은 골라서 반영하는 영역인데, 이 성적에서는 다른 영역보다 나아 <b>' +
                 f1(W['수']) + '%</b>로 뽑혔습니다.');
    } else if (W['수']) {
      lines.push('수학은 <b>' + f1(W['수']) + '%</b>로 반드시 반영합니다.');
    }

    // 활용지표
    if (u.idxKM && u.idxT === u.idxKM) {
      lines.push('국어·수학·탐구 모두 ' + esc(indicatorName(u.idxKM)) + josaRo(indicatorName(u.idxKM)) + ' 반영합니다.');
    } else {
      var idx = [];
      if (u.idxKM) idx.push('국어·수학은 ' + indicatorName(u.idxKM));
      if (u.idxT) idx.push('탐구는 ' + indicatorName(u.idxT));
      if (idx.length) lines.push(esc(idx.join(', ')) + josaRo(idx[idx.length - 1]) + ' 반영합니다.');
    }

    // 유불리와 그 이유
    if (r.gain != null && r.adjPct != null) {
      var c = areaContrib(r);
      var up = c.filter(function (x) { return x.v > 0.3; }).slice(0, 2).map(function (x) { return x.n; });
      var dn = c.filter(function (x) { return x.v < -0.3; }).slice(0, 2).map(function (x) { return x.n; });
      var head = '기준 백분위 <b>' + f1(rp.basePct) + '</b>이 이 대학 방식에서는 <b>' + f1(r.adjPct) + '</b>';
      var why = '';
      if (r.gain >= 1.5) {
        head += josaRo(f1(r.adjPct)) + ' 올라갑니다(' + sgn(r.gain) + ').';
        if (up.length) why = ' 잘하는 ' + esc(up.join('·')) + josa(up[up.length - 1], '이/가') + ' 크게 잡힌 덕입니다.';
        else if (dn.length) why = ' 약한 ' + esc(dn.join('·')) + josa(dn[dn.length - 1], '이/가') + ' 적게 반영된 덕입니다.';
      } else if (r.gain <= -1.5) {
        head += josaRo(f1(r.adjPct)) + ' 내려갑니다(' + sgn(r.gain) + ').';
        if (dn.length) why = ' 약한 ' + esc(dn.join('·')) + '의 비중이 크기 때문입니다.';
      } else {
        head += josaRo(f1(r.adjPct)) + ' 거의 그대로입니다(' + sgn(r.gain) + ').';
      }
      lines.push(head + why);
    }
    return '<div class="why"><p>' + lines.join('</p><p>') + '</p></div>';
  }

  function indicatorName(v) {
    if (v === '표준') return '표준점수';
    if (v === '변환표준') return '대학이 만든 변환표준점수';
    if (v === '표준+백분') return '표준점수와 백분위';
    return v;
  }

  /** 영역별로 기준 백분위 대비 얼마나 끌어올렸는지(내렸는지) 나눈다. */
  function areaContrib(r) {
    var rp = state.rp, W = r.wUsed, tot = 0, out = [];
    for (var a in W) tot += W[a];
    if (!tot) return out;
    var pctOf = {
      '국': rp.kor.pct, '수': rp.math.pct,
      '탐': (rp.tam[0].pct + rp.tam[1].pct) / 2,
      '영': engPctLike(r.u, rp.eng.grade),
      '한': null, '외': null
    };
    for (a in W) {
      if (pctOf[a] == null) continue;
      out.push({ n: AREA_NAME[a], v: W[a] / tot * (pctOf[a] - rp.basePct) });
    }
    out.sort(function (x, y) { return Math.abs(y.v) - Math.abs(x.v); });
    return out;
  }

  /** 영어 등급을 백분위처럼 견주기 위한 근사값. */
  function engPctLike(u, g) {
    if (u.engPts && u.engPts[0] > 0) return Math.max(0, (u.engPts[g - 1] || 0) / u.engPts[0]) * 100;
    return Math.max(0, 100 - (g - 1) * 6);
  }

  function detail(r) {
    var u = r.u, W = r.wUsed, parts = [];
    ['국', '수', '영', '탐', '한', '외'].forEach(function (a) {
      if (W[a]) parts.push(a + ' ' + f1(W[a]) + '%');
    });
    var c = u.compete || [];
    var h = '<div class="det">';
    h += explain(r);
    h += '<p class="memo"><strong>반영 방법 표기</strong> · ' + esc(u.areas || u.memo || '자료 없음') +
         (u.memo && u.memo !== u.areas ? ' — ' + esc(u.memo) : '') + '</p>';
    h += '<dl>';
    h += row('내 성적에 적용된 비율', parts.length ? parts.join(' · ') : '자료 없음');
    if (r.roles) {
      var fixed = [], picks = {}, pickOrder = [];
      ['국', '수', '영', '탐'].forEach(function (a) {
        var ro = r.roles[a];
        if (!ro || ro.role === '미반영') return;
        if (ro.role === '필수') { fixed.push(AREA_NAME[a] + ' ' + f1(ro.max) + '%'); return; }
        var wl = (u._W || E.parseWeights(u.w))[a] || [], k = wl.join('/');
        if (!picks[k]) { picks[k] = []; pickOrder.push(k); }
        picks[k].push(AREA_NAME[a]);
      });
      var kw = E.parseWeights(u.w);
      if (kw['한']) fixed.push('한국사 ' + f1(kw['한'][0]) + '%');
      if (kw['외']) fixed.push('제2외국어 ' + f1(kw['외'][0]) + '%');
      var out = fixed.slice();
      pickOrder.forEach(function (k) {
        var wl = k.split('/').map(parseFloat);
        var scale = wl.length > 1
          ? wl.map(function (v, i) { return (i + 1) + '순위 ' + f1(v) + '%'; }).join(' · ')
          : f1(wl[0]) + '%';
        out.push(picks[k].join('·') + ' 중 골라서 ' + scale);
      });
      // 고를 여지가 없으면 위 '적용된 비율'과 같은 말이라 넣지 않는다.
      if (pickOrder.length) h += row('대학이 정한 비율', esc(out.join(' / ')));
    }
    h += row('활용지표', '국·수 ' + esc(u.idxKM || '–') + ' / 탐구 ' + esc(u.idxT || '–') +
             ' · 탐구 ' + (u.tCnt || 1) + '과목');
    h += row('지정과목', (u.reqMath ? '수학 ' + esc(u.reqMath) : '수학 제한 없음') + ' · ' +
             (u.reqTam ? '탐구 ' + esc(u.reqTam) : '탐구 제한 없음') +
             (r.req.msgs.length ? ' <span class="warn">' + esc(r.req.msgs.join(', ')) + '</span>' : ''));
    h += row('영어 · 한국사', '영어 ' + esc(u.engMethod || '–') +
             (u.engPts ? ' (1등급 ' + f1(u.engPts[0]) + '점 → 내 등급 ' + f1(u.engPts[state.rp.eng.grade - 1]) + '점)' : '') +
             ' / 한국사 ' + esc(u.hisMethod || '–'));
    h += row('전형', esc(u.admit || '–') + (u.major ? ' · 세부전공 ' + esc(u.major) : ''));
    h += row('전형 방법', esc(u.method || '–') + ' · 수능총점 ' + (u.total || '–') +
             (u.totalAll ? ' / 전형총점 ' + u.totalAll : ''));
    h += row('반영 방식 적용 백분위',
             (r.adjPct == null ? '계산 불가' : f1(r.adjPct) + ' <span style="color:#6B6B6B">(기준 ' +
              f1(state.rp.basePct) + ' → 유불리 ' + sgn(r.gain) + ')</span>'));
    if (r.fullScore) {
      h += row('내 환산점(추정)', f1(r.myScore) + ' / 만점 ' + f1(r.fullScore) +
               ' <span style="color:#6B6B6B">(득점률 ' + f1(r.myScore / r.fullScore * 100) + '%)</span>');
    }
    h += row('2025 입시결과', '70%컷 백분위 ' + f1(u.cutPct) +
             (u.cut70 != null ? ' · 대학 자체 환산점 ' + (u.cut50 != null ? u.cut50 + '(50%) / ' : '') + u.cut70 + '(70%)' : ''));
    h += row('모집인원', '2026 ' + (u.n26 == null ? '–' : u.n26) + '명 · 2025 최종 ' +
             (u.nf25 == null ? '–' : u.nf25) + '명(이월 ' + (u.carry25 == null ? '–' : u.carry25) + '명)');
    h += row('경쟁률 · 충원율',
             '2025 ' + (c[0] == null ? '–' : f1(c[0])) + ':1' +
             (c[2] != null ? ' <span style="color:#6B6B6B">(실질 ' + f1(c[2]) + ':1)</span>' : '') +
             ' / 충원 ' + (c[1] == null ? '–' : f1(c[1] * 100) + '%') +
             ' · 2024 ' + (c[3] == null ? '–' : f1(c[3])) + ':1' +
             (c[5] != null ? ' <span style="color:#6B6B6B">(실질 ' + f1(c[5]) + ':1)</span>' : '') +
             ' / 충원 ' + (c[4] == null ? '–' : f1(c[4] * 100) + '%'));
    h += row('입시결과 신뢰도', relText(r));
    if (u.move) h += row('올해 군별 정원', moveText(u));
    if (u.bonus || u.bonusArea) h += row('가산점', esc((u.bonusArea ? '[' + u.bonusArea + '] ' : '') + u.bonus));
    if (u.chgAdmit || u.chgUnit || u.ratioChanged === 'O') {
      h += row('올해 변화', [u.chgAdmit ? '전형 변경' : '', u.chgUnit ? '모집단위 변경' : '',
                            u.ratioChanged === 'O' ? '반영비율 변경' : ''].filter(Boolean).join(' · '));
    }
    h += '</dl>';
    if (u.note) h += '<p class="memo">' + esc(u.note) + '</p>';
    var caution = [];
    if (r.approx || u.match !== 'exact') caution.push('반영비율을 같은 대학의 다른 전형에서 끌어와 맞춘 자리입니다.');
    if (!u.total) caution.push('수능 총점 자료가 없어(모집단위별 변동 등) 반영 유불리를 계산하지 못했습니다.');
    else if (Math.abs(r.fullScore / u.total - 1) > 0.03) caution.push('만점 계산이 대학 총점과 어긋나, 환산점 추정의 오차가 큽니다.');
    if (caution.length) h += '<p class="memo warn">확인 필요 · ' + esc(caution.join(' ')) + '</p>';
    h += '</div>';
    return h;
    function row(t, v) { return '<dt>' + t + '</dt><dd>' + v + '</dd>'; }
  }

  /* ------------------------------------------- 잘 환산해 주는 대학 (탭 3) */

  function drawGain(rows) {
    var by = {}, order = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], k = r.u.univ;
      if (r.gain == null) continue;
      if (!by[k]) { by[k] = { univ: k, zone: r.u.zone, sum: 0, n: 0, all: [], mathFree: 0, topCut: -1 }; order.push(k); }
      var g = by[k];
      g.sum += r.gain; g.n++;
      if (r.math.role !== '필수') g.mathFree++;
      if (r.cut70p != null && r.cut70p > g.topCut) g.topCut = r.cut70p;
      g.all.push(r);
    }
    var list = order.map(function (k) {
      var g = by[k];
      g.avg = g.sum / g.n;
      g.best = g.all.slice().sort(function (a, b) { return (b.cut70p || 0) - (a.cut70p || 0); }).slice(0, 4);
      return g;
    }).sort(function (a, b) {
      return (b.avg - a.avg) || (b.topCut - a.topCut) || a.univ.localeCompare(b.univ, 'ko');
    }).slice(0, 36);

    if (!list.length) {
      $('view').innerHTML = '<div class="tablewrap"><div class="empty">조건에 맞는 대학이 없습니다.</div></div>';
      return;
    }
    var h = '<p class="note" style="margin-top:0">기준 백분위 <strong class="num">' + f1(state.rp.basePct) +
            '</strong>인 학생을 놓고, 대학이 정해 둔 반영 영역·비율·활용지표대로 다시 계산했을 때 ' +
            '얼마나 후하게 매겨 주는지로 줄 세웠습니다. ' +
            '수학이 약하면 수학을 적게 보는 대학이, 영어가 강하면 영어 배점이 큰 대학이 위로 올라옵니다. ' +
            '같은 점수대에서 앞서 나갈 곳을 고르는 눈금으로 쓰시고, 합격 가능성은 왼쪽 두 탭에서 확인해 주세요.</p>';
    h += '<div class="rank">';
    for (var j = 0; j < list.length; j++) {
      var g = list[j];
      h += '<div class="rankcard"><h3>' + esc(g.univ) + '</h3>' +
           '<p class="lede" style="font-size:12px;">' + esc(g.zone) + ' · 모집단위 ' + g.n + '곳' +
           (g.mathFree ? ' · 수학 부담 낮은 곳 ' + g.mathFree + '곳' : '') + '</p>' +
           '<p class="gainv">' + sgn(g.avg) + '</p>' +
           '<p class="gainl">반영 유불리(백분위 눈금 · 평균)</p><ul>';
      for (var m = 0; m < g.best.length; m++) {
        var r = g.best[m];
        h += '<li>' + esc(tie(r.u.unit)) + ' <span class="num" style="color:#6B6B6B">' +
             r.u.term + '군 · 컷 ' + f1(r.cut70p) + ' · ' + (A.LEVEL_NAME[r.level] || '자료 없음') + '</span></li>';
      }
      h += '</ul></div>';
    }
    h += '</div>';
    $('view').innerHTML = h;
  }

  /* --------------------------------------------------- 관심 목록 (탭 4) */

  function drawCart() {
    var picked = [];
    for (var i = 0; i < state.results.length; i++) {
      if (state.cart[cartKey(state.results[i].u)]) picked.push(state.results[i]);
    }
    if (!picked.length) {
      $('view').innerHTML = '<div class="cartempty">아직 담은 곳이 없습니다. ' +
        '표 오른쪽 끝 <span aria-hidden="true">' + BOOKMARK + '</span> 단추를 눌러 담아 두면, ' +
        '가·나·다군으로 정리해 한눈에 견줄 수 있습니다. 담은 목록은 이 브라우저에 남습니다.</div>';
      return;
    }
    var terms = ['가', '나', '다', '군외'], h = '';
    var lv = [0, 0, 0, 0, 0], seat = 0;
    picked.forEach(function (r) { if (r.level >= 0) lv[r.level]++; seat += r.u.n26 || 0; });
    h += '<p class="note" style="margin-top:0">담은 곳 <b class="num">' + picked.length + '</b>곳 · ' +
         '안정 ' + lv[4] + ' · 적정 ' + lv[3] + ' · 소신 ' + lv[2] + ' · 도전 ' + lv[1] + ' · 위험 ' + lv[0] +
         '. 정시는 가·나·다군에서 한 곳씩 모두 세 번 지원합니다. 군별로 고르게 담겼는지 살펴보세요.</p>';

    terms.forEach(function (t) {
      var rows = picked.filter(function (r) { return r.u.term === t; });
      if (!rows.length) return;
      rows.sort(function (a, b) { return (b.cut70p || 0) - (a.cut70p || 0); });
      h += '<div class="cartgroup"><h3>' + t + '군</h3><p class="sub">' + rows.length + '곳 · ' +
           rows.filter(function (r) { return r.level >= 3; }).length + '곳이 적정 이상</p>';
      h += '<div class="tablewrap"><table><thead><tr>' +
        '<th>대학</th><th>모집단위</th><th class="nw fold">계열</th><th class="n">모집<br>·신뢰도</th>' +
        '<th class="n">2025<br>70%컷</th><th class="n">내 기준<br>대비</th><th>가능성</th>' +
        '<th class="n">반영<br>유불리</th>' +
        '<th class="n rt">국어</th><th class="n rt">수학</th><th class="n rt">영어</th><th class="n rt">탐구</th>' +
        '<th class="n rt fold">기타</th><th class="n fold">경쟁률<br>(실질)</th><th class="n">2025<br>충원율</th>' +
        '<th class="noprint">관심</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var u = r.u, c = u.compete || [];
        h += '<tr class="main"><td class="uni">' + esc(u.univ) + '</td>' +
          '<td class="major">' + esc(tie(u.unit)) +
            (u.dupAdmit ? ' <span class="tag plain">' + esc(u.admit) + '</span>' : '') + '</td>' +
          '<td class="nw fold">' + esc(u.track) + '</td>' +
          '<td class="n">' + seatCell(r) + '</td>' +
          '<td class="n">' + f1(r.cut70p) + '</td>' +
          '<td class="n">' + sgn(r.diff) + '</td>' +
          '<td>' + levelCell(r) + '</td>' +
          '<td class="n">' + gainCell(r) + '</td>' + ratioCells(r) +
          '<td class="n fold">' + rateCell(r) + '</td>' +
          '<td class="n">' + (c[1] == null ? '–' : f1(c[1] * 100) + '%') + '</td>' +
          '<td class="noprint">' + keepCell(r) + '</td></tr>';
      });
      h += '</tbody></table></div></div>';
    });
    h += '<div class="more noprint" style="margin-top:24px;">' +
         '<button type="button" class="btn" id="cart-print">인쇄 / PDF로 저장</button> ' +
         '<button type="button" class="btn" id="cart-clear" style="background:none;border-color:var(--line-strong);">' +
         '전부 비우기</button></div>';
    $('view').innerHTML = h;
    bindKeep($('view'));
    $('cart-print').addEventListener('click', function () { window.print(); });
    $('cart-clear').addEventListener('click', function () {
      state.cart = {}; saveCart(); renderCartCount(); draw();
    });
  }

  /* ------------------------------------------------------------- 실행 흐름 */

  var timer = null;
  function schedule() {
    saveProfile();
    if (timer) clearTimeout(timer);
    timer = setTimeout(recompute, 120);
  }

  function recompute() {
    state.rp = A.resolvedProfile();
    state.results = A.evaluate(state.rp);
    updateHints();
    renderSummary();
    renderCompass();
    state.limit = 120;
    draw();
  }

  function draw() {
    var rows = filtered();
    if (state.tab === 'cart') drawCart();
    else if (state.tab === 'gain') drawGain(rows.slice().sort(function (a, b) {
      return (b.gain == null ? -999 : b.gain) - (a.gain == null ? -999 : a.gain);
    }));
    else drawTable(rows);
  }

  function bindTabs() {
    [['tab-all', 'all'], ['tab-math', 'math'], ['tab-gain', 'gain'], ['tab-cart', 'cart']].forEach(function (t) {
      $(t[0]).addEventListener('click', function () {
        state.tab = t[1];
        ['tab-all', 'tab-math', 'tab-gain', 'tab-cart'].forEach(function (id) {
          $(id).setAttribute('aria-selected', id === t[0] ? 'true' : 'false');
        });
        if (t[1] === 'math') { if (state.mathMode === 'any') state.mathMode = 'opt'; }
        else if (state.mathMode !== 'any') { state.mathMode = 'any'; }
        mathChips();
        if (t[1] === 'gain' && state.sort !== 'gain') { state.sort = 'gain'; $('f-sort').value = 'gain'; }
        if (t[1] === 'all' && state.sort === 'gain') { state.sort = 'cut'; $('f-sort').value = 'cut'; }
        $('filters-card').style.display = t[1] === 'cart' ? 'none' : '';
        state.limit = 120;
        draw();
      });
    });
  }

  var FILTER_DEFAULTS = {
    univ: '', unit: '', admit: '', minN: 0, maxRate: 0,
    gainMode: 'any', relMode: 'any', sort: 'cut',
    track: { '인문': true, '자연': true, '의약학': true, '공통': true },
    level: { '4': true, '3': true, '2': true },
    mathMode: 'any', reqOnly: true, cutOnly: true, cartOnly: false
  };

  function resetFilters() {
    state.univ = FILTER_DEFAULTS.univ; state.unit = FILTER_DEFAULTS.unit;
    state.admit = FILTER_DEFAULTS.admit; state.minN = FILTER_DEFAULTS.minN;
    state.maxRate = FILTER_DEFAULTS.maxRate; state.gainMode = FILTER_DEFAULTS.gainMode;
    state.relMode = FILTER_DEFAULTS.relMode;
    state.sort = state.tab === 'gain' ? 'gain' : FILTER_DEFAULTS.sort;
    state.zone = {}; state.term = {};
    state.track = { '인문': true, '자연': true, '의약학': true, '공통': true };
    state.level = { '4': true, '3': true, '2': true };
    state.mathMode = state.tab === 'math' ? 'opt' : 'any';
    state.reqOnly = true; state.cutOnly = true; state.cartOnly = false;
    $('f-univ').value = ''; $('f-unit').value = ''; $('f-admit').value = '';
    $('f-req').checked = true; $('f-cut').checked = true; $('f-cart').checked = false;
    renderFilters();
    state.limit = 120;
    draw();
  }

  function bindFilters() {
    $('f-reset').addEventListener('click', resetFilters);
    $('f-univ').addEventListener('input', function () { state.univ = this.value; state.limit = 120; draw(); });
    $('f-admit').addEventListener('input', function () { state.admit = this.value; state.limit = 120; draw(); });
    $('f-rate').addEventListener('change', function () { state.maxRate = +this.value; state.limit = 120; draw(); });
    $('f-gain').addEventListener('change', function () { state.gainMode = this.value; state.limit = 120; draw(); });
    $('f-rel').addEventListener('change', function () { state.relMode = this.value; state.limit = 120; draw(); });
    $('f-cart').addEventListener('change', function () { state.cartOnly = this.checked; state.limit = 120; draw(); });
    $('f-unit').addEventListener('input', function () { state.unit = this.value; state.limit = 120; draw(); });
    $('f-min').addEventListener('change', function () { state.minN = +this.value; state.limit = 120; draw(); });
    $('f-sort').addEventListener('change', function () { state.sort = this.value; state.limit = 120; draw(); });
    $('f-req').addEventListener('change', function () { state.reqOnly = this.checked; state.limit = 120; draw(); });
    $('f-cut').addEventListener('change', function () { state.cutOnly = this.checked; state.limit = 120; draw(); });
    $('usePct').addEventListener('change', function () { renderScores(); schedule(); });
  }

  document.addEventListener('touchstart', function () {}, { passive: true });

  $('view').innerHTML = '<div class="tablewrap"><div class="empty">자료를 불러오는 중입니다…</div></div>';
  state.cart = loadCart();
  A.load().then(function () {
    state.pristine = !loadProfile();
    if (state.pristine) {
      var note = document.createElement('p');
      note.id = 'firsttime';
      note.className = 'firsttime noprint';
      note.textContent = '아래는 예시 성적입니다. 목표로 삼은 등급으로 바꾸면 결과가 바로 다시 계산되고, 다음에 열 때도 그대로 남습니다.';
      $('scores').parentNode.insertBefore(note, $('scores'));
    }
    renderScores();
    renderCartCount();
    renderFilters();
    bindTabs();
    bindFilters();
    recompute();
  }).catch(function (e) {
    $('view').innerHTML = '<div class="tablewrap"><div class="empty warn">오류: 자료를 불러오지 못했습니다. ' +
      esc(e && e.message) + '</div></div>';
  });
})();
