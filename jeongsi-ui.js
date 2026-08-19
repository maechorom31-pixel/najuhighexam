/* 정시 나침반 — 화면 그리기 */
(function () {
  'use strict';

  var A = window.JeongsiApp;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    tab: 'all',
    univ: '', unit: '', minN: 0, sort: 'cut',
    zone: {}, term: {}, track: { '인문': true, '자연': true, '의약학': true, '공통': true },
    level: { '4': true, '3': true, '2': true }, mathMode: 'any',
    reqOnly: true, cutOnly: true,
    limit: 120,
    results: [], rp: null
  };

  var ZONES = ['서울', '경인권', '충청권', '강원권', '전라권', '경상권', '제주권'];
  var TERMS = ['가', '나', '다'];
  var TRACKS = ['인문', '자연', '의약학', '예체능', '공통'];
  var LEVELS = [['4', '안정'], ['3', '적정'], ['2', '소신'], ['1', '도전'], ['0', '위험']];
  var MATHMODES = [['any', '전체'], ['none', '미반영'], ['opt', '미반영·선택'], ['w20', '20% 이하'], ['w30', '30% 이하']];
  var SORTS = [
    ['cut', '입시결과 높은 순'],
    ['diff', '내 성적과 가까운 순'],
    ['gain', '반영 유불리 유리한 순'],
    ['mathlow', '수학 비중 낮은 순'],
    ['n', '모집인원 많은 순'],
    ['rate', '경쟁률 낮은 순']
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function f1(v) { return v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1); }
  function sgn(v) { return v == null ? '–' : (v >= 0 ? '+' : '') + f1(v); }
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

  /* -------------------------------------------------------------- 필터 UI */

  function renderFilters() {
    $('f-min').innerHTML = [0, 5, 10, 20, 30, 50].map(function (v) {
      return '<option value="' + v + '"' + (v === state.minN ? ' selected' : '') + '>' +
             (v === 0 ? '제한 없음' : v + '명 이상') + '</option>';
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
    var h = '<span class="lab">수학 반영</span>';
    for (var i = 0; i < MATHMODES.length; i++) {
      h += '<button type="button" class="chip" data-v="' + MATHMODES[i][0] + '" aria-pressed="' +
           (state.mathMode === MATHMODES[i][0] ? 'true' : 'false') + '">' + MATHMODES[i][1] + '</button>';
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
    var out = [], q1 = state.univ.trim(), q2 = state.unit.trim();
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
      if (state.tab === 'math' || state.mathMode !== 'any') {
        var m = state.tab === 'math' && state.mathMode === 'any' ? 'opt' : state.mathMode;
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
  function gainCell(r) {
    if (r.gain == null) return '–';
    if (r.gain >= 1.5) return '<span class="tag">유리 ' + sgn(r.gain) + '</span>';
    if (r.gain <= -1.5) return '<span class="tag plain">불리 ' + sgn(r.gain) + '</span>';
    return '<span class="num">' + sgn(r.gain) + '</span>';
  }

  function mathCell(r) {
    if (r.math.role === '미반영') return '<span class="tag">미반영</span>';
    if (r.math.role === '선택') return '<span class="tag">선택 ' + f1(r.math.max) + '%</span>';
    return '<span class="num">' + f1(r.math.max) + '%</span>';
  }

  function drawTable(rows) {
    if (!rows.length) {
      $('view').innerHTML = '<div class="tablewrap"><div class="empty">조건에 맞는 모집단위가 없습니다. 권역이나 판정 조건을 넓혀 보세요.</div></div>';
      return;
    }
    var shown = rows.slice(0, state.limit);
    var h = '<div class="tablewrap"><table><thead><tr>' +
      '<th>군</th><th>대학</th><th>모집단위</th><th>계열</th>' +
      '<th class="n">모집</th><th class="n">2025<br>70%컷</th><th class="n">내 기준<br>대비</th>' +
      '<th>가능성</th><th class="n">반영<br>유불리</th><th class="n">수학<br>비중</th><th class="n">2025<br>경쟁률</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < shown.length; i++) {
      var r = shown[i], u = r.u;
      h += '<tr class="main"><td>' + esc(u.term) + '</td>' +
        '<td class="uni">' + esc(u.univ) + '</td>' +
        '<td class="major"><button type="button" class="rowbtn" data-i="' + i + '">' +
          esc(tie(u.unit)) + (u.major ? ' <span class="tag plain">세부</span>' : '') +
          (!r.req.ok ? ' <span class="warn">지정과목 확인</span>' : '') + '</button></td>' +
        '<td>' + esc(u.track) + '</td>' +
        '<td class="n">' + (u.n26 == null ? '–' : u.n26) + '</td>' +
        '<td class="n">' + f1(r.cut70p) + '</td>' +
        '<td class="n">' + sgn(r.diff) + '</td>' +
        '<td>' + levelCell(r) + '</td>' +
        '<td class="n">' + gainCell(r) + '</td>' +
        '<td class="n">' + mathCell(r) + '</td>' +
        '<td class="n">' + (u.compete && u.compete[0] != null ? f1(u.compete[0]) : '–') + '</td></tr>';
      h += '<tr class="det" id="det-' + i + '" hidden><td colspan="11">' + detail(r) + '</td></tr>';
    }
    h += '</tbody></table></div>';
    if (rows.length > state.limit) {
      h += '<div class="more noprint"><button type="button" class="btn" id="more">' +
           '더 보기 (' + shown.length.toLocaleString() + ' / ' + rows.length.toLocaleString() + ')</button></div>';
    }
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
    if ($('more')) $('more').addEventListener('click', function () { state.limit += 120; draw(); });
  }

  function detail(r) {
    var u = r.u, W = r.wUsed, parts = [];
    ['국', '수', '영', '탐', '한', '외'].forEach(function (a) {
      if (W[a]) parts.push(a + ' ' + f1(W[a]) + '%');
    });
    var c = u.compete || [];
    var h = '<div class="det">';
    h += '<p class="memo"><strong>반영 방법</strong> · ' + esc(u.areas || u.memo || '자료 없음') +
         (u.memo && u.memo !== u.areas ? ' — ' + esc(u.memo) : '') + '</p>';
    h += '<dl>';
    h += row('내 성적에 적용된 비율', parts.length ? parts.join(' · ') : '자료 없음');
    h += row('활용지표', '국·수 ' + esc(u.idxKM || '–') + ' / 탐구 ' + esc(u.idxT || '–') +
             ' · 탐구 ' + (u.tCnt || 1) + '과목');
    h += row('지정과목', (u.reqMath ? '수학 ' + esc(u.reqMath) : '수학 제한 없음') + ' · ' +
             (u.reqTam ? '탐구 ' + esc(u.reqTam) : '탐구 제한 없음') +
             (r.req.msgs.length ? ' <span class="warn">' + esc(r.req.msgs.join(', ')) + '</span>' : ''));
    h += row('영어 · 한국사', '영어 ' + esc(u.engMethod || '–') +
             (u.engPts ? ' (1등급 ' + f1(u.engPts[0]) + '점 → 내 등급 ' + f1(u.engPts[state.rp.eng.grade - 1]) + '점)' : '') +
             ' / 한국사 ' + esc(u.hisMethod || '–'));
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
    h += row('경쟁률 · 충원율', '2025 ' + (c[0] == null ? '–' : f1(c[0])) + ':1 / 충원 ' +
             (c[1] == null ? '–' : f1(c[1] * 100) + '%') + ' · 2024 ' +
             (c[2] == null ? '–' : f1(c[2])) + ':1 / 충원 ' + (c[3] == null ? '–' : f1(c[3] * 100) + '%'));
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

  /* ------------------------------------------------------------- 실행 흐름 */

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(recompute, 120);
  }

  function recompute() {
    state.rp = A.resolvedProfile();
    state.results = A.evaluate(state.rp);
    updateHints();
    renderSummary();
    state.limit = 120;
    draw();
  }

  function draw() {
    var rows = filtered();
    if (state.tab === 'gain') drawGain(rows.slice().sort(function (a, b) { return b.gain - a.gain; }));
    else drawTable(rows);
  }

  function bindTabs() {
    [['tab-all', 'all'], ['tab-math', 'math'], ['tab-gain', 'gain']].forEach(function (t) {
      $(t[0]).addEventListener('click', function () {
        state.tab = t[1];
        ['tab-all', 'tab-math', 'tab-gain'].forEach(function (id) {
          $(id).setAttribute('aria-selected', id === t[0] ? 'true' : 'false');
        });
        if (t[1] === 'math' && state.mathMode === 'any') { state.mathMode = 'opt'; mathChips(); }
        if (t[1] === 'gain' && state.sort !== 'gain') { state.sort = 'gain'; $('f-sort').value = 'gain'; }
        state.limit = 120;
        draw();
      });
    });
  }

  function bindFilters() {
    $('f-univ').addEventListener('input', function () { state.univ = this.value; state.limit = 120; draw(); });
    $('f-unit').addEventListener('input', function () { state.unit = this.value; state.limit = 120; draw(); });
    $('f-min').addEventListener('change', function () { state.minN = +this.value; state.limit = 120; draw(); });
    $('f-sort').addEventListener('change', function () { state.sort = this.value; state.limit = 120; draw(); });
    $('f-req').addEventListener('change', function () { state.reqOnly = this.checked; state.limit = 120; draw(); });
    $('f-cut').addEventListener('change', function () { state.cutOnly = this.checked; state.limit = 120; draw(); });
    $('usePct').addEventListener('change', function () { renderScores(); schedule(); });
  }

  document.addEventListener('touchstart', function () {}, { passive: true });

  $('view').innerHTML = '<div class="tablewrap"><div class="empty">자료를 불러오는 중입니다…</div></div>';
  A.load().then(function () {
    renderScores();
    renderFilters();
    bindTabs();
    bindFilters();
    recompute();
  }).catch(function (e) {
    $('view').innerHTML = '<div class="tablewrap"><div class="empty warn">오류: 자료를 불러오지 못했습니다. ' +
      esc(e && e.message) + '</div></div>';
  });
})();
