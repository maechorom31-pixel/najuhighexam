/* 정시 나침반 — 화면 로직 */
(function () {
  'use strict';

  var E = window.JeongsiEngine;
  var META = null, UNITS = [], READY = false;

  /* ------------------------------------------------------------ 과목 정보 */

  var SATAM = ['생활과윤리', '윤리와사상', '한국지리', '세계지리', '동아시아사',
               '세계사', '경제', '정치와법', '사회문화'];
  var GWATAM = ['물리학Ⅰ', '화학Ⅰ', '생명과학Ⅰ', '지구과학Ⅰ',
                '물리학Ⅱ', '화학Ⅱ', '생명과학Ⅱ', '지구과학Ⅱ'];
  var MATH_TYPES = ['확률과통계', '미적분', '기하'];

  // 백분위 등급 경계 (해당 백분위 이상이면 그 등급)
  var GRADE_CUT = [96, 89, 77, 60, 40, 23, 11, 4, 0];

  function pctToGrade(p) {
    for (var i = 0; i < GRADE_CUT.length; i++) if (p >= GRADE_CUT[i]) return i + 1;
    return 9;
  }
  function gradeNorm(g) { return Math.max(0, 1 - (g - 1) * 0.06); }

  /* ------------------------------------------------------------ 자료 적재 */

  function expand(packed) {
    var cols = packed.cols, dict = packed.dict, rows = packed.rows, out = [];
    for (var i = 0; i < rows.length; i++) {
      var o = {}, r = rows[i];
      for (var c = 0; c < cols.length; c++) {
        var name = cols[c];
        o[name] = dict[name] ? dict[name][r[c]] : r[c];
      }
      o.idx = i;
      out.push(o);
    }
    return out;
  }

  function load() {
    return Promise.all([
      fetch('data/jeongsi/meta.json?v=2').then(function (r) { return r.json(); }),
      fetch('data/jeongsi/units.json?v=2').then(function (r) { return r.json(); })
    ]).then(function (res) {
      META = res[0];
      UNITS = expand(res[1]);
      markDuplicates(UNITS);
      markRuleKeys(UNITS);
      READY = true;
    });
  }

  /** 같은 대학·군·모집단위가 전형만 다르게 여러 줄 있으면 표에서 구분해 줘야 한다. */
  function markDuplicates(units) {
    var seen = {};
    for (var i = 0; i < units.length; i++) {
      var u = units[i], k = u.univ + '|' + u.term + '|' + u.unit;
      (seen[k] = seen[k] || []).push(u);
    }
    for (var k2 in seen) {
      if (seen[k2].length < 2) continue;
      var names = {};
      for (var j = 0; j < seen[k2].length; j++) names[seen[k2][j].admit] = true;
      if (Object.keys(names).length < 2) continue;
      for (j = 0; j < seen[k2].length; j++) seen[k2][j].dupAdmit = true;
    }
  }

  /** 반영 규칙이 같은 모집단위는 환산 결과도 같다. 5,730개가 646가지로 줄어든다. */
  function markRuleKeys(units) {
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      u._rk = [u.univ, u.areas, u.w.join(','), u.idxKM, u.idxT, u.tCnt, u.total,
               u.engMethod, u.hisMethod,
               u.engPts ? u.engPts.join(',') : '', u.hisPts ? u.hisPts.join(',') : ''].join('|');
    }
  }

  /* --------------------------------------------------------- 학생 성적 모델 */

  var profile = {
    kor: { grade: 3, band: 'mid', pct: null },
    math: { grade: 3, band: 'mid', pct: null, type: '확률과통계' },
    eng: { grade: 3 },
    hist: { grade: 3 },
    tam: [
      { grade: 3, band: 'mid', pct: null, name: '생활과윤리', cat: '사탐' },
      { grade: 3, band: 'mid', pct: null, name: '사회문화', cat: '사탐' }
    ],
    lang2: { grade: 0 }   // 0 = 미응시
  };

  function bandValue(sub, grade, band) {
    var b = META.gradeBands[sub];
    if (!b || !b[grade]) return [0, 0];
    return b[grade][band] || b[grade].mid;
  }

  /** 과목별 (백분위, 표준점수) 확정 */
  function resolve(item, sub) {
    if (item.pct != null && item.pct !== '') {
      var p = Math.max(0, Math.min(100, Math.round(item.pct)));
      return { pct: p, std: META.pctToStd[sub][p], grade: pctToGrade(p) };
    }
    var v = bandValue(sub, item.grade, item.band);
    return { pct: v[1], std: v[0], grade: item.grade };
  }

  function tamSub(cat) { return cat === '과탐' ? '과탐' : '사과탐'; }

  function resolvedProfile() {
    var r = {
      kor: resolve(profile.kor, '국어'),
      math: resolve(profile.math, '수학'),
      eng: { grade: profile.eng.grade },
      hist: { grade: profile.hist.grade },
      tam: [resolve(profile.tam[0], tamSub(profile.tam[0].cat)),
            resolve(profile.tam[1], tamSub(profile.tam[1].cat))],
      lang2: { grade: profile.lang2.grade }
    };
    r.mathType = profile.math.type;
    r.tamCat = [profile.tam[0].cat, profile.tam[1].cat];
    r.tamName = [profile.tam[0].name, profile.tam[1].name];
    // 기준 백분위 = 국수탐(2) 백분위 평균. 엑셀의 입시결과 백분위와 같은 축이다.
    // AVERAGE(국어, 수학, AVERAGE(탐구1, 탐구2))
    r.basePct = (r.kor.pct + r.math.pct + (r.tam[0].pct + r.tam[1].pct) / 2) / 3;
    return r;
  }

  /* --------------------------------------------------- 대학별 지표 정규화 */

  function byunpyoSeries(u) {
    var t = META.byunpyo[u.univ];
    if (!t) return null;
    if (t['통합']) return t['통합'];
    var keys = Object.keys(t);
    return t[keys[0]];
  }

  /** 0~100 백분위 배열에서 소수 백분위까지 선형 보간 */
  function lerp(arr, p) {
    if (!arr) return null;
    var x = Math.max(0, Math.min(100, p)), lo = Math.floor(x), hi = Math.ceil(x);
    var a = arr[lo], b = arr[hi];
    if (a == null || b == null) return a == null ? b : a;
    return a + (b - a) * (x - lo);
  }

  function normFor(indicator, sub, pct, std, grade, bp) {
    switch (indicator) {
      case '백분위': return pct / 100;
      case '표준': return std / META.maxStd[sub];
      case '등급': return gradeNorm(grade);
      case '변환표준':
        if (bp) {
          var top = bp[100], v = lerp(bp, pct);
          if (v != null && top) return v / top;
        }
        return pct / 100;
      case '표준+백분': return (std / META.maxStd[sub] + pct / 100) / 2;
      default: return pct / 100;
    }
  }

  /** 특정 백분위 p 를 국·수·탐에 균일 적용했을 때의 영역별 정규화 값 */
  function normsAt(u, rp, p, bp, engG, hisG) {
    var g = pctToGrade(p);
    engG = engG || rp.eng.grade; hisG = hisG || rp.hist.grade;
    var stdK = lerp(META.pctToStd['국어'], p), stdM = lerp(META.pctToStd['수학'], p);
    var n = {
      '국': normFor(u.idxKM, '국어', p, stdK, g, null),
      '수': normFor(u.idxKM, '수학', p, stdM, g, null),
      '영': engNorm(u, engG),
      '한': hisNorm(u, hisG),
      '외': gradeNorm(rp.lang2.grade || 9)
    };
    for (var i = 0; i < 2; i++) {
      var sub = tamSub(rp.tamCat[i]);
      n['탐' + (i + 1)] = normFor(u.idxT, sub, p, lerp(META.pctToStd[sub], p), g, bp);
    }
    return n;
  }

  function normsActual(u, rp, bp) {
    var n = {
      '국': normFor(u.idxKM, '국어', rp.kor.pct, rp.kor.std, rp.kor.grade, null),
      '수': normFor(u.idxKM, '수학', rp.math.pct, rp.math.std, rp.math.grade, null),
      '영': engNorm(u, rp.eng.grade),
      '한': hisNorm(u, rp.hist.grade),
      '외': gradeNorm(rp.lang2.grade || 9)
    };
    for (var i = 0; i < 2; i++) {
      var sub = tamSub(rp.tamCat[i]);
      n['탐' + (i + 1)] = normFor(u.idxT, sub, rp.tam[i].pct, rp.tam[i].std, rp.tam[i].grade, bp);
    }
    return n;
  }

  /* 영어·한국사는 등급별 배점표로 계산하지만, '택N'에서 다른 영역과 견주려면
     같은 0~1 축의 값이 필요하다. 배점표를 만점 배점으로 나눠 쓴다. */
  function engNorm(u, g) {
    if (u.engPts && u.engPts[0] > 0) return Math.max(0, (u.engPts[g - 1] || 0) / u.engPts[0]);
    return gradeNorm(g);
  }
  function hisNorm(u, g) {
    if (u.hisPts && u.hisPts[0] > 0) return Math.max(0, (u.hisPts[g - 1] || 0) / u.hisPts[0]);
    return gradeNorm(g);
  }

  /* --------------------------------------------------------- 지정과목 판정 */

  function checkRequirement(u, rp) {
    var msgs = [], ok = true, cond = false;
    var rm = u.reqMath || '';
    if (rm) {
      if (/유형/.test(rm)) cond = true;
      else if (rm.indexOf('확통') < 0 && rp.mathType === '확률과통계') {
        ok = false; msgs.push('수학 ' + rm + ' 응시자만 반영');
      } else if (rm === '확통' && rp.mathType !== '확률과통계') {
        cond = true; msgs.push('수학 확률과통계 지정');
      }
    }
    var rt = u.reqTam || '';
    if (rt) {
      if (/유형/.test(rt)) cond = true;
      else {
        var need = rt.indexOf('과탐') >= 0 && rt.indexOf('사탐') < 0;
        var needSa = rt.indexOf('사탐') >= 0 && rt.indexOf('과탐') < 0;
        var cnt = (u.tCnt || 1);
        var have = 0, i;
        for (i = 0; i < 2; i++) {
          if (need && rp.tamCat[i] === '과탐') have++;
          if (needSa && rp.tamCat[i] === '사탐') have++;
        }
        if ((need || needSa) && have < cnt) {
          ok = false;
          msgs.push('탐구 ' + rt + ' ' + cnt + '과목 필요');
        }
      }
    }
    return { ok: ok, cond: cond, msgs: msgs };
  }

  /* ------------------------------------------------- 영역별 반영 성격 */

  /** 그 영역을 반드시 반영하는지(필수), 골라서 반영하는지(선택), 안 보는지(미반영). */
  function areaRole(u, area) {
    var terms = u._terms !== undefined ? u._terms : (u._terms = E.parsePattern(u.areas, u.tCnt));
    var W = u._W || (u._W = E.parseWeights(u.w));
    if (!W[area]) return { role: '미반영', max: 0 };
    if (!terms) return { role: '필수', max: W[area][0] };
    var inFix = false, inPick = false;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i], j, has = false;
      if (t.kind === 'rest') { inPick = true; continue; }
      for (j = 0; j < t.areas.length; j++) {
        if (E.baseArea(t.areas[j]) === area) { has = true; break; }
      }
      if (!has) continue;
      if (t.kind === 'fix') inFix = true; else inPick = true;
    }
    if (inFix) return { role: '필수', max: W[area][0] };
    if (inPick) return { role: '선택', max: W[area][0] };
    return { role: '미반영', max: 0 };
  }

  function mathRole(u) { return areaRole(u, '수'); }

  /** 국·수·영·탐 네 영역의 반영 성격을 한 번에. 규칙이 같으면 결과도 같아 캐시한다. */
  function areaRoles(u) {
    if (u._roles) return u._roles;
    return (u._roles = {
      '국': areaRole(u, '국'), '수': areaRole(u, '수'),
      '영': areaRole(u, '영'), '탐': areaRole(u, '탐')
    });
  }

  /* --------------------------------------------------------------- 평가 */

  function evaluate(rp) {
    var out = [], cache = {};
    for (var i = 0; i < UNITS.length; i++) {
      var u = UNITS[i];
      var calc = cache[u._rk];
      if (calc === undefined) {
        calc = cache[u._rk] = convert(u, rp);
      }
      var roles = areaRoles(u);
      var cut = u.cutPct;                       // 대학이 공개한 2025 70%컷(국수탐 백분위 평균)
      var diff = cut != null ? rp.basePct - cut : null;

      out.push({
        u: u,
        myScore: calc.score,
        adjPct: calc.pct,       // 이 대학 반영 방식을 그대로 적용한 백분위 (참고값)
        fullScore: calc.full,
        wUsed: calc.w,
        approx: calc.approx,
        cut70p: cut,
        diff: diff,             // 판정 기준: 기준 백분위 - 70%컷
        level: judge(diff),
        gain: calc.pct == null ? null : calc.pct - rp.basePct,   // 반영 유불리
        math: roles['수'],
        roles: roles,
        mathUsed: calc.w['수'] || 0,
        req: checkRequirement(u, rp)
      });
    }
    return out;
  }

  /** 한 가지 반영 규칙에 대해 환산점·환산 백분위·만점을 구한다. */
  function convert(u, rp) {
    var bp = u.idxT === '변환표준' ? byunpyoSeries(u) : null;
    var mine = E.scoreUnit(u, normsActual(u, rp, bp), rp.eng.grade, rp.hist.grade);
    if (!u.total) {
      return { score: mine.total, pct: null, full: 0, w: mine.w, approx: mine.approx };
    }
    // 국·수·탐이 점수에 전혀 영향을 주지 않으면 환산 백분위를 낼 수 없다.
    var s0 = E.scoreUnit(u, normsAt(u, rp, 0, bp), rp.eng.grade, rp.hist.grade).total;
    var s100 = E.scoreUnit(u, normsAt(u, rp, 100, bp), rp.eng.grade, rp.hist.grade).total;
    var pct = null;
    if (s100 - s0 > 1e-6) {
      // 기준 백분위 학생과 점수가 같으면 유불리가 없는 것이다.
      // 등급만 보는 대학처럼 점수가 구간마다 평평한 경우, 이분 탐색은 그 구간의
      // 아래 끝으로 내려가 실제보다 손해 본 것처럼 보이게 한다. 그래서 먼저 확인한다.
      var atBase = E.scoreUnit(u, normsAt(u, rp, rp.basePct, bp), rp.eng.grade, rp.hist.grade).total;
      var tol = Math.max(1e-9, Math.abs(mine.total) * 1e-10);
      if (Math.abs(atBase - mine.total) <= tol) {
        pct = rp.basePct;
      } else {
        // 국·수·탐을 모두 같은 백분위로 받은 학생과 견주어, 같은 점수가 되는 백분위를 찾는다.
        var lo = 0, hi = 100, mid, f;
        for (var it = 0; it < 17; it++) {
          mid = (lo + hi) / 2;
          f = E.scoreUnit(u, normsAt(u, rp, mid, bp), rp.eng.grade, rp.hist.grade).total;
          if (f < mine.total) lo = mid; else hi = mid;
        }
        pct = (lo + hi) / 2;
      }
    }
    var full = E.scoreUnit(u, normsAt(u, rp, 100, bp, 1, 1), 1, 1).total;
    return { score: mine.total, pct: pct, full: full, w: mine.w, approx: mine.approx };
  }

  // 0 위험 · 1 도전 · 2 소신 · 3 적정 · 4 안정 · -1 자료 없음
  // 기준은 국수탐(2) 백분위 평균의 차이. 정시에서 1점 차이는 크므로 폭을 좁게 잡았다.
  function judge(diff) {
    if (diff == null) return -1;
    if (diff >= 1.5) return 4;
    if (diff >= 0.3) return 3;
    if (diff >= -0.5) return 2;
    if (diff >= -2.0) return 1;
    return 0;
  }

  var LEVEL_NAME = ['위험', '도전', '소신', '적정', '안정'];

  window.JeongsiApp = {
    load: load,
    profile: profile,
    resolvedProfile: resolvedProfile,
    evaluate: evaluate,
    mathRole: mathRole,
    areaRole: areaRole,
    LEVEL_NAME: LEVEL_NAME,
    SATAM: SATAM, GWATAM: GWATAM, MATH_TYPES: MATH_TYPES,
    units: function () { return UNITS; },
    meta: function () { return META; },
    ready: function () { return READY; }
  };
})();
