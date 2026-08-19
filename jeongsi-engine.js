/* 정시 나침반 — 계산 엔진
 * 경기도교육청 '정시NAVI' 자료(2026학년도 정시)를 근거로
 * 학생 성적을 대학별 수능 반영 방법에 맞춰 환산한다.
 *
 * 핵심 개념
 *  - 반영영역 표기('택2(국수영)+탐1한' 등)를 파싱해 실제로 반영되는 영역을 정한다.
 *  - 대학이 유리하게 골라 주는 영역은 학생에게 가장 유리하도록 배점을 배정한다.
 *  - '환산 백분위'는 국수탐을 모두 백분위 p로 받은 학생과 같은 점수가 되는 p 값이다.
 *    엑셀이 제공하는 입시결과 백분위와 같은 축이라 바로 견줄 수 있다.
 */
(function (global) {
  'use strict';

  var AREA = ['국', '수', '영', '탐', '한', '외'];   // unit.w 배열 순서

  /* ---------------------------------------------------------- 반영영역 파서 */

  function splitTerms(p) {
    var parts = [], depth = 0, buf = '';
    for (var i = 0; i < p.length; i++) {
      var ch = p[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === '+' && depth === 0) { parts.push(buf); buf = ''; }
      else buf += ch;
    }
    parts.push(buf);
    return parts;
  }

  function tokenize(txt, tcnt) {
    var t = String(txt || '').trim(), out = [], i = 0;
    while (i < t.length) {
      var c = t[i];
      if (c === '탐') {
        var j = i + 1, d = '';
        while (j < t.length && t[j] >= '0' && t[j] <= '9') { d += t[j]; j++; }
        if (d) { out.push(['탐', parseInt(d, 10)]); i = j; continue; }
        out.push(['탐', 0]); i++; continue;
      }
      if ('국수영한'.indexOf(c) >= 0) { out.push([c, 0]); i++; continue; }
      if (t.substr(i, 2) === '제2') { out.push(['외', 0]); i += 2; continue; }
      if ('외독프중漢'.indexOf(c) >= 0) { out.push(['외', 0]); i++; continue; }
      if (' ,/'.indexOf(c) >= 0) { i++; continue; }
      return null;
    }
    var tamCount = 0, k;
    for (k = 0; k < out.length; k++) if (out[k][0] === '탐') tamCount++;
    var res = [], n = 0;
    for (k = 0; k < out.length; k++) {
      if (out[k][0] !== '탐') { res.push(out[k][0]); continue; }
      if (tamCount >= 2) { n++; res.push('탐#' + n); }            // '탐탐' = 과목별로 경쟁
      else res.push('탐@' + (out[k][1] || (tcnt || 1)));           // '탐2' = 상위 2과목 평균
    }
    return res;
  }

  function parsePattern(pat, tcnt) {
    var p = String(pat || '').trim();
    if (!p) return null;
    var raws = splitTerms(p), terms = [];
    for (var i = 0; i < raws.length; i++) {
      var t = raws[i].trim().replace(/^(필수|선택)\s*/, '').trim();
      if (/미반영|이외/.test(t)) {
        var mm = t.match(/택\s*(\d+)/);
        terms.push({ kind: 'rest', n: mm ? parseInt(mm[1], 10) : 1, avg: false });
        continue;
      }
      var m = t.match(/^택\s*(\d+)\s*(평균)?\s*\((.*)\)$/);
      if (m) {
        var n = parseInt(m[1], 10), avg = !!m[2], inner = m[3];
        var m2 = inner.match(/^(.*?)\s*중\s*(\d+)\s*개\s*평균$/);
        if (m2) { inner = m2[1]; avg = true; n = parseInt(m2[2], 10); }
        var ar = tokenize(inner, tcnt);
        if (!ar) return null;
        terms.push({ kind: 'pick', areas: ar, n: n, avg: avg });
        continue;
      }
      t = t.replace(/\([^)]*\)$/, '').trim();
      var ar2 = tokenize(t, tcnt);
      if (!ar2) return null;
      terms.push({ kind: 'fix', areas: ar2, n: ar2.length, avg: false });
    }
    return terms.length ? terms : null;
  }

  function parseWeights(ws) {
    var out = {};
    for (var i = 0; i < AREA.length; i++) {
      var raw = String(ws[i] == null ? '' : ws[i]).trim();
      if (!raw) continue;
      var parts = raw.split('/'), vals = [], ok = true;
      for (var j = 0; j < parts.length; j++) {
        var v = parseFloat(parts[j]);
        if (isNaN(v)) { ok = false; break; }
        vals.push(v);
      }
      if (ok && vals.length) out[AREA[i]] = vals;
    }
    return out;
  }

  function baseArea(a) { return a.charAt(0) === '탐' ? '탐' : a; }

  /* ------------------------------------------------------------ 점수 계산 */

  function areaNorm(a, norms) {
    if (a.indexOf('탐@') === 0) {
      var n = parseInt(a.slice(2), 10) || 1;
      var vs = [];
      if (norms['탐1'] != null) vs.push(norms['탐1']);
      if (norms['탐2'] != null) vs.push(norms['탐2']);
      if (!vs.length) return null;
      vs.sort(function (x, y) { return y - x; });
      vs = vs.slice(0, n);
      var s = 0;
      for (var i = 0; i < vs.length; i++) s += vs[i];
      return s / vs.length;
    }
    if (a.indexOf('탐#') === 0) return norms['탐' + a.slice(2)];
    return norms[a];
  }

  /** 배점 목록에서 아직 안 쓴 순위의 값. 값이 하나뿐이면 몇 번이든 같은 값을 쓴다. */
  function rankW(wl, rank) {
    if (wl.length === 1) return wl[0];
    return rank < wl.length ? wl[rank] : 0;
  }

  function assign(term, W, norms, used, chosen, ranks) {
    var areas = [], i;
    for (i = 0; i < term.areas.length; i++) {
      if (W[baseArea(term.areas[i])]) areas.push(term.areas[i]);
    }
    if (!areas.length) return;

    var order = [], groups = {};
    for (i = 0; i < areas.length; i++) {
      var k = W[baseArea(areas[i])].join('/');
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(areas[i]);
    }
    function nv(a) { var v = areaNorm(a, norms); return v == null ? -1 : v; }
    function bySelf(a, b) { return nv(b) - nv(a); }

    // 같은 배점 목록('60/40' 등)은 항 하나에서만 쓰이는 게 아니라
    // 반영영역 전체에 걸쳐 1순위·2순위로 나뉜다. 어디까지 썼는지 이어서 센다.
    if (term.kind === 'fix') {
      for (i = 0; i < order.length; i++) {
        var gk = order[i], wl = W[baseArea(groups[gk][0])], mem = groups[gk].slice().sort(bySelf);
        for (var j = 0; j < mem.length; j++) {
          used[mem[j]] = rankW(wl, ranks[gk] || 0);
          ranks[gk] = (ranks[gk] || 0) + 1;
          chosen[baseArea(mem[j])] = true;
        }
      }
      return;
    }
    if (order.length === 1) {
      var gk2 = order[0], wl2 = W[baseArea(groups[gk2][0])];
      var mem2 = groups[gk2].slice().sort(bySelf).slice(0, term.n);
      for (i = 0; i < mem2.length; i++) {
        used[mem2[i]] = term.avg ? rankW(wl2, ranks[gk2] || 0) / mem2.length
                                 : rankW(wl2, ranks[gk2] || 0);
        if (!term.avg) ranks[gk2] = (ranks[gk2] || 0) + 1;
        chosen[baseArea(mem2[i])] = true;
      }
      if (term.avg) ranks[gk2] = (ranks[gk2] || 0) + 1;
      return;
    }
    var cand = [];
    for (i = 0; i < areas.length; i++) {
      var k2 = W[baseArea(areas[i])].join('/');
      var w0 = rankW(W[baseArea(areas[i])], ranks[k2] || 0);
      cand.push({ v: w0 * Math.max(nv(areas[i]), 0), a: areas[i], w: w0, k: k2 });
    }
    cand.sort(function (x, y) { return y.v - x.v; });
    for (i = 0; i < Math.min(term.n, cand.length); i++) {
      used[cand[i].a] = cand[i].w;
      ranks[cand[i].k] = (ranks[cand[i].k] || 0) + 1;
      chosen[baseArea(cand[i].a)] = true;
    }
  }

  /** 대학 환산 점수. norms 는 영역별 0~1 값. */
  function scoreUnit(u, norms, engGrade, hisGrade) {
    var T = u.total || 0, W = u._W || (u._W = parseWeights(u.w));
    var terms = u._terms !== undefined ? u._terms : (u._terms = parsePattern(u.areas, u.tCnt));
    var approx = false, i;
    if (!terms) {
      approx = true;
      var ar = [];
      ['국', '수', '영', '한', '외'].forEach(function (a) { if (W[a]) ar.push(a); });
      if (W['탐']) ar.push('탐@' + (u.tCnt || 1));
      terms = [{ kind: 'fix', areas: ar, n: ar.length, avg: false }];
    }

    var used = {}, chosen = {}, rest = [], ranks = {};
    for (i = 0; i < terms.length; i++) {
      if (terms[i].kind === 'rest') rest.push(terms[i]);
      else assign(terms[i], W, norms, used, chosen, ranks);
    }
    for (i = 0; i < rest.length; i++) {
      var pool = [];
      ['국', '수', '영', '탐@1', '한', '외'].forEach(function (a) {
        if (!chosen[baseArea(a)] && W[baseArea(a)]) pool.push(a);
      });
      assign({ kind: 'pick', areas: pool, n: rest[i].n, avg: rest[i].avg }, W, norms, used, chosen, ranks);
    }

    var em = u.engMethod || '', hm = u.hisMethod || '';
    var engFlat = em === '가산점' || em === '감점' || em === '가감점';
    var hisFlat = hm === '가산점' || hm === '감점' || hm === '가감점';

    var total = 0, byArea = {};
    for (var a in used) {
      if (!used.hasOwnProperty(a)) continue;
      var b = baseArea(a);
      byArea[b] = (byArea[b] || 0) + used[a];
      var v = areaNorm(a, norms);
      if (v == null) continue;
      // 영어·한국사는 등급별 배점표가 곧 만점 배점이므로, 실제 배정된 비율만큼만 쓴다.
      total += T * used[a] / 100 * v;
    }
    // 가산점·감점 방식은 반영비율과 무관하게 총점에 더하고 뺀다.
    if (u.engPts && engFlat) total += u.engPts[engGrade - 1] || 0;
    if (u.hisPts && hisFlat) total += u.hisPts[hisGrade - 1] || 0;

    return { total: total, w: byArea, used: used, approx: approx };
  }

  global.JeongsiEngine = {
    AREA: AREA,
    parsePattern: parsePattern,
    parseWeights: parseWeights,
    baseArea: baseArea,
    scoreUnit: scoreUnit
  };
})(window);
