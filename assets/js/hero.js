/* Homepage hero: the agent. The site chatbot (chat.js, window.DayamChat) is the
   whole first screen: an orb made of the logo's square, and under it the
   conversation. The orb assembles on load, leans toward the pointer, lights
   the squares under it, quickens as the visitor types, sweeps while the agent
   reads, and while it answers a voice ring and waves of light follow each word.
   Speeds ease and angles only accumulate, so nothing ever jumps.
   Spec: docs/superpowers/specs/2026-10-01-hero-agent-console-design.md */
(function(){
  'use strict';

  var root = document.getElementById('heroConsole');
  if (!root) return;
  // Hiding the whole hero (not just the console) leaves the page starting at the headline.
  var stage = root.closest('.ah') || root;
  // chat.js (deferred, earlier in the page) sets this only once it knows it will
  // start. Without it the console would be a dead input, so it goes.
  if (!window.DayamChatLoading || !window.HTMLCanvasElement || !('IntersectionObserver' in window)) {
    stage.hidden = true;
    return;
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var STATUS = { idle: 'Listening', thinking: 'Reading your question', speaking: 'Answering' };
  // The input suggests these in turn; Enter on an empty box asks the one shown.
  var EXAMPLES = [
    'We re-type every order into Tally',
    'I can’t see sales and stock in one place',
    'Customers ask the same questions all day',
    'Our site gets visits, not enquiries'
  ];

  // ===== Orb =====
  // `host` gets data-field="running" while the loop runs and "still" otherwise,
  // so the loop's state can be checked from outside.
  function Orb(cv, host, area){
    var ctx = cv.getContext('2d'), W = 0, H = 0, D = 0, raf = 0, on = false, last = 0;
    var BLUE = [47, 123, 255], HI = [141, 182, 255], WHITE = [235, 242, 255];
    var N = 520, P = [], BARS = 96;
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      P.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, key: i % 23 === 0, sx: Math.random() * 2 - 1, sy: Math.random() * 2 - 1, d: Math.random() * .5 });
    }
    var S = { mode: 'idle', t: 0, born: reduce ? 9 : 0, energy: 0, nudge: 0, think: 0, speak: 0, ang: 0, arc0: 0, arc1: 0,
      tx: 0, ty: 0, vx: 0, vy: 0, gx: 0, gy: 0, px: .5, py: .5, near: false, ripples: [], bv: [], bt: [], lastPulse: 0,
      ph: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28] };
    for (var b = 0; b < BARS; b++) { S.bv.push(0); S.bt.push(0); }

    function rgba(c, a){ return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
    function lerp(a, b, k){ return a + (b - a) * k; }
    function easeOut(x){ return 1 - Math.pow(1 - x, 4); }
    function size(){
      var d = Math.min(2, window.devicePixelRatio || 1);
      if (cv.clientWidth === W && cv.clientHeight === H && d === D) return;
      D = d; W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }

    function step(dt){
      S.t += dt; S.born += dt;
      // moods ease in and out over about a second, never switch
      S.think = lerp(S.think, S.mode === 'thinking' ? 1 : 0, Math.min(1, dt * 1.6));
      S.speak = lerp(S.speak, S.mode === 'speaking' ? 1 : 0, Math.min(1, dt * 1.2));
      // a voice-like envelope: slow overlapping waves with random phases, plus a nudge per word
      var t = S.t, env = .5 + .5 * (Math.sin(t * 1.15 + S.ph[0]) * .5 + Math.sin(t * 1.9 + S.ph[1]) * .3 + Math.sin(t * .55 + S.ph[2]) * .2);
      S.nudge *= Math.pow(.25, dt);
      S.energy = lerp(S.energy, Math.min(1, S.speak * (.45 + env * .55) + S.nudge * .5 + S.think * .2), Math.min(1, dt * 3));
      // the tilt follows the pointer on a spring: it leans in, with a little weight
      S.vx += ((S.gx * .9 - S.tx) * 30 - S.vx * 8) * dt; S.vy += ((S.gy * .7 - S.ty) * 30 - S.vy * 8) * dt;
      S.tx += S.vx * dt; S.ty += S.vy * dt;
      // speeds change; angles only ever accumulate, so nothing jumps
      var e = S.energy;
      S.ang += dt * (.2 + S.think * .45 + e * .25);
      S.arc0 += dt * (.25 + S.think * 1.1 + e * 1.2);
      S.arc1 -= dt * .18;
      for (var b = 0; b < BARS; b++) { S.bt[b] *= Math.pow(.12, dt); S.bv[b] = lerp(S.bv[b], S.bt[b], Math.min(1, dt * 9)); }
      S.ripples = S.ripples.filter(function(r){ return S.t - r.t0 < 1.6; });
    }

    function draw(){
      size();
      ctx.clearRect(0, 0, W, H);
      var e = S.energy, t = S.t, cx = W / 2, cy = H / 2, R = Math.max(36, Math.min(H / 2 - 6, W / 2 - 6) / 1.7);
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.72);
      g.addColorStop(0, rgba(BLUE, .2 + e * .4)); g.addColorStop(.5, rgba(BLUE, .05 + e * .12)); g.addColorStop(1, rgba(BLUE, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var grow = easeOut(Math.min(1, S.born / 1.4));
      ctx.globalAlpha = grow;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.42, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(178,196,230,.14)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(178,196,230,.08)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, S.arc0, S.arc0 + .55 + e * .5); ctx.lineWidth = 2; ctx.strokeStyle = rgba(HI, .9); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.42, S.arc1, S.arc1 + 1.1); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(BLUE, .6); ctx.stroke();
      ctx.globalAlpha = 1;
      // the voice ring: bars ease toward the shape each word sets, then settle
      var r0 = R * 1.3, maxL = R * .22;
      for (var b = 0; b < BARS; b++) {
        var a = b / BARS * 6.283 - 1.5708, L = 2 + S.bv[b] * maxL + S.speak * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + L), cy + Math.sin(a) * (r0 + L));
        ctx.lineWidth = 2.2; ctx.strokeStyle = rgba(S.bv[b] > .35 ? HI : BLUE, (.14 + S.bv[b] * .85) * grow); ctx.stroke();
      }
      var ry = S.ang + S.tx * 1.1, rx = .35 + S.ty * .9, cr = Math.cos(ry), sr = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      // it breathes: a slow swell that deepens while it talks
      var rad = R * (1 + e * .09 + Math.sin(t * 1.1) * .012), k = Math.max(.8, Math.min(1.6, R / 120));
      var mx = S.px * W, my = S.py * H, lightR = R * .55;
      for (var i = 0; i < N; i++) {
        var p = P[i], x = p.x * cr - p.z * sr, z = p.x * sr + p.z * cr, y = p.y * cX - z * sX; z = p.y * sX + z * cX;
        var depth = (z + 1) / 2, px = cx + x * rad, py = cy + y * rad;
        // each square drifts on its own slow beat, more while it talks: a ripple, not a shake
        var w = 1 + e * .06 * Math.sin(t * 2.2 + p.d * 37);
        px = cx + (px - cx) * w; py = cy + (py - cy) * w;
        // assembly: each square flies in from where it was scattered
        var in_ = easeOut(Math.max(0, Math.min(1, (S.born - p.d) / 1.1)));
        if (in_ < 1) { px = (cx + p.sx * W * .6) * (1 - in_) + px * in_; py = (cy + p.sy * H * .6) * (1 - in_) + py * in_; }
        var s = (1.4 + depth * 3.2) * k, alpha = ((p.key ? .3 : .12) + depth * .8) * in_, c = depth > .55 ? WHITE : BLUE;
        // waves of light travel outward across the face and fade
        if (S.ripples.length && depth > .2) {
          var dn = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)) / rad, v = 0;
          for (var j = 0; j < S.ripples.length; j++) { var rp = S.ripples[j], age = S.t - rp.t0, q = dn - age * 1.1; v += rp.a * Math.exp(-q * q / .03) * Math.exp(-age * 1.4); }
          v = Math.min(1.2, v) * (.4 + depth * .6);
          if (v > .02) { var push = 1 + v * .1; px = cx + (px - cx) * push; py = cy + (py - cy) * push; s *= 1 + v * 1.3; alpha = Math.min(1, alpha + v); if (v > .12) c = HI; if (v > .45) c = WHITE; }
        }
        if (S.near && depth > .45) { var dx = px - mx, dy = py - my, d2 = dx * dx + dy * dy; if (d2 < lightR * lightR) { var l = 1 - Math.sqrt(d2) / lightR; s *= 1 + l * .9; c = HI; alpha = Math.min(1, alpha + l * .5); } }
        ctx.fillStyle = rgba(c, alpha);
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }

    function frame(now){
      raf = 0;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 0;
      last = now;
      step(dt);
      draw();
      if (on) raf = requestAnimationFrame(frame);
    }

    if (fine) {
      area.addEventListener('pointermove', function(e){
        var bx = cv.getBoundingClientRect();
        S.px = (e.clientX - bx.left) / bx.width; S.py = (e.clientY - bx.top) / bx.height;
        S.near = S.px > 0 && S.px < 1 && S.py > 0 && S.py < 1;
        S.gx = e.clientX / innerWidth - .5; S.gy = e.clientY / innerHeight - .5;
      }, { passive: true });
      area.addEventListener('pointerleave', function(){ S.near = false; S.gx = 0; S.gy = 0; });
    }
    draw();
    host.setAttribute('data-field', 'still');
    addEventListener('resize', function(){ if (!on) draw(); }, { passive: true });

    return {
      // Loop only while on screen, and never under reduced motion (one still frame instead).
      run: function(yes){
        on = !!yes && !reduce;
        if (on && !raf) { last = 0; raf = requestAnimationFrame(frame); }
        if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
        host.setAttribute('data-field', on ? 'running' : 'still');
      },
      mode: function(m){ S.mode = m; if (!on) draw(); },
      // A wave of light and a new shape for the voice ring. Pulses closer than
      // 110 ms merge into one, so fast typing never flickers.
      pulse: function(a){
        if (reduce) return;
        var now = performance.now();
        if (S.ripples.length && now - S.lastPulse < 110) { var r = S.ripples[S.ripples.length - 1]; r.a = Math.max(r.a, a); return; }
        S.lastPulse = now; S.ripples.push({ t0: S.t, a: a }); if (S.ripples.length > 12) S.ripples.shift();
        var o1 = Math.random() * 6.28, o2 = Math.random() * 6.28, f1 = 2 + Math.floor(Math.random() * 3), f2 = 5 + Math.floor(Math.random() * 4);
        for (var b = 0; b < BARS; b++) { var th = b / BARS * 6.283; S.bt[b] = Math.max(S.bt[b], a * (.45 + .35 * Math.sin(th * f1 + o1) + .2 * Math.sin(th * f2 + o2))); }
        S.nudge = Math.min(1, S.nudge + a * .25);
      }
    };
  }

  // ===== Voice =====
  // The browser's own voices (free; the owner compared them with OpenAI TTS and
  // chose these). Off on arrival, kept for the visit. One utterance per sentence:
  // Chrome cuts long utterances off at ~15 s, and speech can start before the
  // reply has finished streaming. A reply with no voice for its language stays
  // text-only rather than being read in the wrong accent.
  var VOICE_KEY = 'dayamVoice';
  var PREFER = {
    en: [/^Google UK English Female$/, /^Google US English$/, /natural/i],
    hi: [/^Google हिन्दी$/],
    ar: []
  };
  function Voice(){
    var synth = window.speechSynthesis;
    var ok = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
    var on = false, unlocked = false, queue = [], cur = null, gaveUp = false;
    var hold = 0, guard = 0, lull = 0, beat = 0;
    var onWord = function(){}, onDone = function(){};
    try { on = ok && sessionStorage.getItem(VOICE_KEY) === '1'; } catch (e) {}
    if (ok) {
      synth.getVoices();   // Chrome loads the list lazily; ask early.
      if (synth.addEventListener) synth.addEventListener('voiceschanged', function(){
        clearTimeout(hold); hold = 0;
        if (!cur && queue.length) next();
      });
    }

    function lang(text){ return /[\u0900-\u097F]/.test(text) ? 'hi' : /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en'; }
    function pick(code){
      var all = synth.getVoices().filter(function(v){ return String(v.lang).toLowerCase().indexOf(code) === 0; });
      for (var i = 0; i < PREFER[code].length; i++) {
        for (var j = 0; j < all.length; j++) if (PREFER[code][i].test(all[j].name)) return all[j];
      }
      return all[0] || null;
    }
    // What a person would read aloud: link text without the URL, no page paths, no markdown marks.
    function plain(s){
      return String(s).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
        .replace(/\S*\/\S+\.html\S*/g, '')
        .replace(/[*_`#>]/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim();
    }
    function timers(){ clearTimeout(guard); clearTimeout(lull); clearInterval(beat); }
    // Only the current utterance's own end moves the queue on: a late event
    // from a cancelled one (Chrome reports cancel() as an async error) is ignored.
    function finish(u, stuck){
      if (u !== cur) return;
      timers();
      cur = null;
      if (stuck) synth.cancel();   // a jammed engine would hold every later sentence behind it
      next();
    }
    function next(){
      if (cur) return;
      if (!queue.length) { onDone(); return; }
      // The voice list can still be loading (Android especially): wait for it, briefly.
      if (!synth.getVoices().length && !gaveUp) {
        if (!hold) hold = setTimeout(function(){ hold = 0; gaveUp = true; next(); }, 1500);
        return;
      }
      var text = queue.shift(), v = pick(lang(text));
      if (!v) { next(); return; }
      var u = new SpeechSynthesisUtterance(text), heard = false;
      u.voice = v;
      u.lang = v.lang;
      // Some voices (Chrome's network "Google" ones) send no word boundaries:
      // if none has come shortly after the start, the rings tick on a timer.
      u.onstart = function(){
        if (u !== cur) return;
        clearTimeout(guard);
        guard = setTimeout(function(){ finish(u, true); }, text.length * 120 + 2000);
        lull = setTimeout(function(){ if (!heard && u === cur) beat = setInterval(onWord, 260); }, 400);
      };
      u.onboundary = function(e){
        if (u !== cur || (e.name && e.name !== 'word')) return;
        heard = true;
        clearInterval(beat);
        onWord();
      };
      u.onend = u.onerror = function(){ finish(u); };
      cur = u;   // also keeps the utterance referenced: Chrome can drop onend for a collected one
      // Chrome sometimes never starts, or never sends an end; don't let the queue jam on it.
      // This waits for the start; onstart re-arms it to the length of the sentence.
      guard = setTimeout(function(){ finish(u, true); }, 4000);
      synth.speak(u);
    }
    return {
      supported: ok,
      on: function(){ return on; },
      set: function(yes){
        var want = ok && !!yes;
        if (!want) this.stop();
        on = want;
        try { sessionStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch (e) {}
      },
      // iOS speaks only after speak() has run inside a user gesture: call this from clicks.
      unlock: function(){
        if (!ok || !on || unlocked) return;
        unlocked = true;
        try { synth.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
      },
      say: function(sentence){
        if (!on) return;
        var s = plain(sentence);
        if (s) { queue.push(s); next(); }
      },
      stop: function(){
        var was = cur, busy = !!(cur || queue.length || hold);
        queue = [];
        cur = null;
        timers();
        clearTimeout(hold); hold = 0;
        if (ok && busy) synth.cancel();
        if (was) onDone();
      },
      speaking: function(){ return !!cur || queue.length > 0; },
      hooks: function(word, done){ onWord = word; onDone = done; }
    };
  }


  // ===== Console =====
  // Drawn at once; wired to the conversation when chat.js is ready.
  (function(){
    var Chat = null;
    var statusEl = root.querySelector('.hc-status-text');
    var answer = root.querySelector('.hc-answer');
    var chips = root.querySelector('.hc-chips');
    var form = root.querySelector('.hc-ask');
    var input = root.querySelector('.hc-input');
    var sendBtn = root.querySelector('.hc-send');
    var spk = root.querySelector('.hc-voice');
    var helloText = root.querySelector('.ah-hello-text');
    var mode = 'idle', visible = false, msg = null, segEl = null, segText = '', asking = '', pending = '';
    var question = '', page = '', shown = '', stick = true;
    var voice = Voice();
    var orb = Orb(stage.querySelector('.ah-orb canvas'), root, stage);

    function setMode(m){
      mode = m;
      root.setAttribute('data-mode', m);
      statusEl.textContent = STATUS[m];
      orb.mode(m);
    }
    // The orb keeps the one brand blue; the service is recorded for styling and tests.
    function setColour(svc){ root.setAttribute('data-svc', svc || ''); }
    function setBusy(on){
      sendBtn.disabled = on;
      Array.prototype.forEach.call(chips.querySelectorAll('button'), function(b){ b.disabled = on; });
    }
    function talking(on){
      root.classList.toggle('is-talking', on);
      if (on) { clearTimeout(phTimer); input.placeholder = 'Ask a follow-up'; }
    }
    // Hand every finished sentence in `buf` to the voice; return the unfinished rest.
    // "1. Export orders" and "e.g. Tally" are not sentence ends.
    var NOT_AN_END = /(^|\s)(\d+|e\.g|i\.e|etc|vs|approx|mr|ms|dr)[.]$/i;
    function speakSentences(buf){
      var re = /([.!?।؟]+["”’)]*)\s+|\n+/g, m, cut = 0;
      while ((m = re.exec(buf))) {
        var end = m.index + (m[1] ? m[1].length : 0), head = buf.slice(cut, end);
        if (m[1] && NOT_AN_END.test(head)) continue;
        voice.say(head);
        cut = re.lastIndex;
      }
      return buf.slice(cut);
    }
    // The thread follows the reply only while the reader is at the bottom;
    // scrolling up to reread leaves them where they are.
    answer.addEventListener('scroll', function(){ stick = answer.scrollHeight - answer.scrollTop - answer.clientHeight < 40; }, { passive: true });
    function keepDown(force){ if (force) stick = true; if (stick) answer.scrollTop = answer.scrollHeight; }

    // The conversation: the visitor's words on the right, the agent's under the
    // square, its page card and the next step after each answer.
    function showQuestion(text){
      talking(true);
      var q = document.createElement('p');
      q.className = 'hc-q';
      q.textContent = text;
      answer.appendChild(q);
      question = text;
      var m = document.createElement('div');
      m.className = 'hc-msg';
      m.innerHTML = '<div class="hc-body"><span class="hc-typing" aria-hidden="true"><i></i><i></i><i></i></span></div>';
      answer.appendChild(m);
      msg = m.querySelector('.hc-body');
      segEl = null;
      keepDown(true);
    }
    function dropTyping(){ var d = msg && msg.querySelector('.hc-typing'); if (d) d.remove(); }
    function addText(delta){
      if (!msg) showQuestion(question);
      dropTyping();
      if (!segEl) {
        segEl = document.createElement('div');
        segEl.className = 'hc-text';
        msg.appendChild(segEl);
        segText = '';
      }
      segText += delta;
      var open = (segText.match(/\*\*/g) || []).length % 2;
      segEl.innerHTML = Chat.md(open ? segText + '**' : segText);
      keepDown();
    }
    function addCard(card){
      if (!msg) return;
      dropTyping();
      segEl = null;
      msg.appendChild(Chat.cardNode(card));
      keepDown();
    }
    // After every answer: the next step, without leaving the conversation. The
    // agent takes the visitor's details in the chat itself (its capture_lead tool),
    // so the first button asks it to; once details are in, only WhatsApp remains.
    var TEAM = 'I’d like the team to get in touch.';
    function addNext(){
      if (!msg) return;
      Array.prototype.forEach.call(answer.querySelectorAll('.hc-next'), function(n){ n.remove(); });
      var bar = document.createElement('div');
      bar.className = 'hc-next';
      var go = null;
      if (!(Chat.state().leads || []).length) {
        go = document.createElement('button');
        go.type = 'button';
        go.className = 'hc-go';
        go.innerHTML = 'Have the team contact me <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
        go.addEventListener('click', function(){ ask(TEAM); });
      }
      var wa = document.createElement('a');
      wa.className = 'hc-wa';
      wa.href = Chat.whatsapp('Hi Dayam Insights, I asked your AI agent: ' + (question || 'about my business') + '.');
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.textContent = 'WhatsApp a person';
      if (go) bar.appendChild(go);
      bar.appendChild(wa);
      msg.appendChild(bar);
      keepDown();
    }

    // A returning visitor (the conversation follows them between pages) sees
    // where they left off, not the empty greeting.
    function restore(){
      var prev = Chat.last();
      if (!prev) return;
      chips.hidden = true;
      showQuestion(prev.question);
      dropTyping();
      prev.items.forEach(function(e){
        if (e.error) return;
        if (e.who === 'card') {
          addCard(e.card);
          if (e.card.kind === 'page') { page = e.card.page; setColour(Chat.svc(e.card)); }
        } else if (e.who === 'bot') {
          segEl = null;
          addText(e.text);
        }
      });
      addNext();
    }
    function reset(){
      answer.innerHTML = '';
      msg = null; segEl = null; question = ''; page = '';
      talking(false);
      chips.hidden = false;
      setColour('');
      cyclePH();
    }

    // The Worker sends each reply whole (it is not streamed, to stay inside the
    // free plan's CPU limit), so the hero writes it out word by word at a reading
    // pace, and the orb follows each word as it appears. Cards and the end of the
    // turn wait until the words are out. Reduced motion shows the reply at once.
    var incoming = '', waiting = [], revealT = 0;
    function reveal(){
      revealT = 0;
      if (!incoming) { var w = waiting; waiting = []; w.forEach(function(ev){ handle(ev[0], ev[1]); }); return; }
      // A long backlog is written faster, a few words at a time, so it never lags far behind.
      var backlog = incoming.length > 400, m = (backlog ? /^(\s*\S+\s*){1,3}/ : /^\s*\S+\s*/).exec(incoming), word = m ? m[0] : incoming;
      incoming = incoming.slice(word.length);
      if (mode !== 'speaking') setMode('speaking');
      addText(word);
      pending = speakSentences(pending + word);   // each sentence is spoken as it appears
      if (!voice.on() || !voice.speaking()) orb.pulse(.35 + Math.min(.45, word.replace(/\W/g, '').length * .05));
      var pause = backlog ? 0 : /[.!?]["”’)]*\s*$/.test(word) ? 260 : /[,;:]\s*$/.test(word) ? 120 : 0;
      revealT = setTimeout(reveal, (backlog ? 40 : 70) + Math.random() * (backlog ? 30 : 70) + pause);
    }
    function flush(){
      clearTimeout(revealT); revealT = 0;
      if (incoming) { addText(incoming); incoming = ''; }
      var w = waiting; waiting = [];
      w.forEach(function(ev){ handle(ev[0], ev[1]); });
    }
    // Every turn, wherever it was asked (here or in the panel).
    function onTurn(type, d){
      if (type === 'turn') flush();
      if (type === 'delta' && !reduce) {
        incoming += d.delta;
        if (!revealT) reveal();
        return;
      }
      if ((type === 'card' || type === 'done' || type === 'error') && (incoming || revealT)) { waiting.push([type, d]); return; }
      handle(type, d);
    }
    function handle(type, d){
      if (type === 'turn') {
        voice.stop();
        pending = '';
        if (d.text === asking) { input.value = ''; form.classList.remove('filled'); }
        answer.setAttribute('aria-busy', 'true');
        chips.hidden = true;
        page = '';
        showQuestion(d.text);
        setColour('');
        setBusy(true);
        setMode('thinking');
      } else if (type === 'delta') {
        if (mode !== 'speaking') setMode('speaking');
        addText(d.delta);
        pending = speakSentences(pending + d.delta);
      } else if (type === 'card') {
        addCard(d.card);
        if (d.card.kind === 'page') { page = d.card.page; setColour(d.svc); }
      } else if (type === 'done') {
        answer.removeAttribute('aria-busy');
        setBusy(false);
        dropTyping();
        if (pending.trim()) voice.say(pending);
        pending = '';
        addNext();
        asking = '';
        if (!voice.speaking()) setMode('idle');
      } else if (type === 'error') {
        voice.stop();
        pending = '';
        setBusy(false);
        segEl = null;
        addText(d.message);
        // The panel adds a WhatsApp card here; the hero's own next step already carries one.
        if (d.code !== 'reset') addNext();
        if (d.text && d.text === asking) { input.value = d.text; form.classList.add('filled'); }
        asking = '';
        answer.removeAttribute('aria-busy');
        setMode('idle');
      }
    }

    voice.hooks(
      function(){ orb.pulse(.5); },
      function(){ if (!sendBtn.disabled) setMode('idle'); }
    );
    if (!voice.supported) spk.hidden = true;
    spk.setAttribute('aria-pressed', String(voice.on()));
    spk.addEventListener('click', function(){
      voice.set(!voice.on());
      voice.unlock();
      spk.setAttribute('aria-pressed', String(voice.on()));
    });

    // Until chat.js is ready the buttons wait. A disabled default button also
    // blocks Enter, so nothing is sent into the void.
    setColour('');
    setMode('idle');
    setBusy(true);

    function ask(text){
      if (!Chat || sendBtn.disabled) return;
      text = String(text || '').trim();
      if (!text) return;
      asking = text;
      voice.unlock();
      Chat.send(text);
    }
    chips.addEventListener('click', function(e){
      var b = e.target.closest('.hc-chip');
      if (b && !b.disabled) ask(b.getAttribute('data-q') || b.textContent);
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      // An empty box asks the question it is suggesting: one key to a first answer.
      ask(input.value.trim() || (!root.classList.contains('is-talking') ? shown : ''));
    });
    input.addEventListener('input', function(){
      form.classList.toggle('filled', !!input.value);
      orb.pulse(.22);
    });

    // The greeting writes itself in once the orb has assembled.
    var hello = helloText.textContent;
    if (!reduce) {
      helloText.textContent = '';
      setTimeout(function(){
        var i = 0;
        (function tick(){ helloText.textContent = hello.slice(0, ++i); if (i < hello.length) setTimeout(tick, 34 + Math.random() * 40); })();
      }, 700);
    }

    // The placeholder suggests real questions in turn.
    var ex = 0, phTimer = 0;
    function cyclePH(){
      clearTimeout(phTimer);
      if (root.classList.contains('is-talking') || input.value) return;
      shown = EXAMPLES[ex++ % EXAMPLES.length];
      if (reduce) { input.placeholder = shown; phTimer = setTimeout(cyclePH, 3800); return; }
      var i = 0;
      (function type(){ input.placeholder = shown.slice(0, ++i); if (i < shown.length) phTimer = setTimeout(type, 28); else phTimer = setTimeout(cyclePH, 3200); })();
    }
    phTimer = setTimeout(cyclePH, 1600);

    // Type anywhere on the hero: printable keys go to the agent, Enter asks.
    document.addEventListener('keydown', function(e){
      if (!visible || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      var a = document.activeElement, tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || (a && a.isContentEditable)) return;
      if (document.querySelector('.dc-panel:not([hidden])')) return;
      if (e.key === 'Enter') { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); return; }
      if (e.key.length === 1) input.focus({ preventScroll: true });
    });

    // "Visible" for the header button, the nudge and type-anywhere means a quarter
    // of the hero is on screen; the orb runs whenever any of it is.
    new IntersectionObserver(function(es){
      var e = es[es.length - 1];
      visible = e.intersectionRatio >= .25;
      orb.run(e.isIntersecting);
    }, { threshold: [0, .25] }).observe(stage);

    // The header turns navy while it sits over the hero, and back once the page moves on.
    var toneRaf = 0;
    function tone(){
      toneRaf = 0;
      document.documentElement.classList.toggle('on-dark', !stage.hidden && stage.getBoundingClientRect().bottom > 72);
    }
    addEventListener('scroll', function(){ if (!toneRaf) toneRaf = requestAnimationFrame(tone); }, { passive: true });
    tone();

    function wire(){
      Chat = window.DayamChat;
      if (!Chat || !Chat.on) { stage.hidden = true; tone(); return; }
      Chat.on(onTurn);
      Chat.setHero({
        visible: function(){ return visible; },
        focus: function(){ input.focus(); }
      });
      setBusy(Chat.busy());
      restore();
      addEventListener('pagehide', function(){ voice.stop(); });
      // Back/forward cache: chat.js has reloaded the conversation; show where it is now.
      addEventListener('pageshow', function(e){
        if (!e.persisted) return;
        voice.stop();
        clearTimeout(revealT); revealT = 0; incoming = ''; waiting = [];
        pending = '';
        asking = '';
        answer.removeAttribute('aria-busy');
        reset();
        restore();
        setBusy(Chat.busy());
        setMode('idle');
      });
    }
    document.addEventListener('dayamchat:failed', function(){ stage.hidden = true; tone(); }, { once: true });
    if (window.DayamChat && window.DayamChat.send) wire();
    else document.addEventListener('dayamchat:ready', wire, { once: true });
  })();
})();
