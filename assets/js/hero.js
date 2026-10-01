/* Homepage hero: the agent console. The site chatbot (chat.js, window.DayamChat)
   driven from the hero, with the signal field drawn behind the conversation:
   a grid of squares whose centre breathes, which sweeps while the agent reads
   the question and sends a ring out with every piece of the reply, in the
   colour of the service the answer points to.
   Spec: docs/superpowers/specs/2026-10-01-hero-agent-console-design.md */
(function(){
  'use strict';

  var root = document.getElementById('heroConsole');
  if (!root) return;
  // Hiding the whole stage (not just the console) leaves no empty grid cell or gap.
  var stage = root.closest('.hero-stage') || root;
  // chat.js (deferred, earlier in the page) sets this only once it knows it will
  // start. Without it the console would be a dead input, so it goes.
  if (!window.DayamChatLoading || !window.HTMLCanvasElement || !('IntersectionObserver' in window)) {
    stage.hidden = true;
    return;
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 599px)');
  // Field colour per service class, as "r,g,b": the --see, --auto and --grow tokens.
  var RGB = { 'svc-see': '30,123,255', 'svc-auto': '255,154,31', 'svc-grow': '22,179,100' };
  var BLUE = '30,123,255';
  var STATUS = { idle: 'Listening', thinking: 'Reading your question', speaking: 'Answering' };
  var PLACEHOLDER = { wide: 'What’s slowing your business down?', small: 'Ask about your business' };

  // ===== Field =====
  // `host` gets data-field="running" while the loop runs and "still" otherwise,
  // so the loop's state can be checked from outside.
  function Field(cv, host){
    var ctx = cv.getContext('2d'), W = 0, H = 0, D = 0, t = 0, last = 0, raf = 0, on = false;
    var mode = 'idle', energy = 0, target = 0, rgb = BLUE, rings = [], idleAt = 0;

    function size(){
      var d = Math.min(2, window.devicePixelRatio || 1);
      if (cv.clientWidth === W && cv.clientHeight === H && d === D) return;
      D = d;
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    // Brightness at distance `dist` from the centre from every ring still travelling.
    function ringsAt(dist){
      var v = 0;
      for (var i = 0; i < rings.length; i++) {
        var age = t - rings[i].t0, x = dist - age * 240;
        v += rings[i].a * Math.exp(-x * x / 288) * Math.exp(-age * 1.1);
      }
      return v * .75;
    }
    function draw(){
      ctx.clearRect(0, 0, W, H);
      // The grid is laid from the centre out, so the core sits exactly on a cell.
      var cell = 18, cx = Math.round(W / 2), cy = Math.round(H * .46), sweep = t * 3.2;
      var reach = Math.max(W, H) * .58, ox = cx % cell, oy = cy % cell;
      for (var py = oy; py < H + cell; py += cell) for (var px = ox; px < W + cell; px += cell) {
        var dx = px - cx, dy = py - cy, d = Math.sqrt(dx * dx + dy * dy);
        var v = ringsAt(d);
        if (mode === 'thinking' && !reduce) {
          var da = Math.abs(((Math.atan2(dy, dx) - sweep) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
          v += Math.max(0, 1 - da * 2.2) * Math.max(0, 1 - d / (reach * .9)) * .75;
        }
        v += Math.max(0, 1 - d / (58 + energy * 30)) * (.55 + energy * .45);              // the halo round the core
        v += Math.max(0, Math.sin(dx * .016 + t * .55) * Math.cos(dy * .021 - t * .4)) * .16; // the slow drift
        v += .05 + .03 * Math.sin(px * .04 + py * .07 + t * .8);                          // the breath
        v = Math.min(1, v) * Math.max(0, 1 - d / reach);
        var s = 1.5 + v * 6.5;
        ctx.fillStyle = v > .3 ? 'rgba(' + rgb + ',' + (.18 + v * .82) + ')' : 'rgba(159,176,200,' + (.07 + v * .8) + ')';
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      // The core: the logo's square, lit. It swells with each word.
      var c = 12 + energy * 8 + (mode === 'thinking' && !reduce ? 2 * Math.sin(t * 9) : 0);
      ctx.save();
      ctx.shadowColor = 'rgba(' + rgb + ',.85)';
      ctx.shadowBlur = 22 + energy * 30;
      ctx.fillStyle = 'rgb(' + rgb + ')';
      ctx.fillRect(cx - c / 2, cy - c / 2, c, c);
      ctx.restore();
    }
    function frame(now){
      raf = 0;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 0;
      last = now; t += dt;
      target *= Math.pow(.02, dt);
      energy += (target - energy) * Math.min(1, dt * 12);
      if (mode === 'idle' && t - idleAt > 3.2) { idleAt = t; rings.push({ t0: t, a: .25 }); }
      rings = rings.filter(function(r){ return t - r.t0 < 3; });
      draw();
      if (on) raf = requestAnimationFrame(frame);
    }

    size();
    draw();
    host.setAttribute('data-field', 'still');
    addEventListener('resize', function(){ size(); draw(); }, { passive: true });

    return {
      // Loop only while on screen, and never under reduced motion (one still frame instead).
      run: function(yes){
        on = !!yes && !reduce;
        if (on && !raf) { last = 0; raf = requestAnimationFrame(frame); }
        if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
        host.setAttribute('data-field', on ? 'running' : 'still');
      },
      mode: function(m){ mode = m; if (!on) draw(); },
      pulse: function(a){
        if (reduce) return;
        target = Math.min(1, a);
        rings.push({ t0: t, a: a });
        if (rings.length > 40) rings.shift();
      },
      colour: function(c){ rgb = c; if (!on) draw(); }
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
    var mode = 'idle', visible = false, segEl = null, segText = '', asking = '', pending = '';
    var question = '', page = '';
    var voice = Voice();
    var hintHTML = answer.innerHTML;
    var field = Field(root.querySelector('.hc-stage canvas'), root);

    function setMode(m){
      mode = m;
      root.setAttribute('data-mode', m);
      statusEl.textContent = STATUS[m];
      field.mode(m);
    }
    function setColour(svc){
      root.setAttribute('data-svc', svc || '');
      field.colour(RGB[svc] || BLUE);
    }
    function setBusy(on){
      sendBtn.disabled = on;
      Array.prototype.forEach.call(chips.querySelectorAll('button'), function(b){ b.disabled = on; });
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

    function asked(){ return Chat.state().log.filter(function(e){ return e.who === 'me'; }).length; }
    function keepDown(){ answer.scrollTop = answer.scrollHeight; }

    // The answer area holds the latest exchange only: the question, then the
    // reply as text segments with any cards between them.
    function showQuestion(text){
      answer.innerHTML = '';
      segEl = null;
      var q = document.createElement('p');
      q.className = 'hc-q';
      q.textContent = text;
      answer.appendChild(q);
      question = text;
    }
    function addText(delta){
      if (!segEl) {
        segEl = document.createElement('div');
        segEl.className = 'hc-text';
        answer.appendChild(segEl);
        segText = '';
      }
      segText += delta;
      segEl.innerHTML = Chat.md(segText);
      keepDown();
    }
    function addCard(card){
      segEl = null;
      answer.appendChild(Chat.cardNode(card));
      keepDown();
    }
    // After every answer: the next step, in the visitor's terms. The plan link
    // presets the contact form to the service the agent pointed at.
    var INTENT = { dashboards: 'Dashboards & reporting', automation: 'Workflow automation', ai_assistants: 'An AI assistant', chatbot: 'An AI assistant', websites: 'A website' };
    function addNext(){
      if (answer.querySelector('.hc-next')) return;
      var bar = document.createElement('div');
      bar.className = 'hc-next';
      var go = document.createElement('a');
      go.className = 'hc-go';
      go.href = '#contact';
      go.setAttribute('data-intent', INTENT[page] || 'Not sure yet');
      go.innerHTML = 'Get a fixed-price plan <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      var wa = document.createElement('a');
      wa.className = 'hc-wa';
      wa.href = Chat.whatsapp('Hi Dayam Insights, I asked your AI agent: ' + (question || 'about my business') + '.');
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.textContent = 'WhatsApp a person';
      bar.appendChild(go);
      bar.appendChild(wa);
      answer.appendChild(bar);
      keepDown();
    }
    function addFullLink(){
      if (asked() < 2 || answer.querySelector('.hc-full')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hc-full';
      b.textContent = 'See full conversation';
      b.addEventListener('click', function(){ Chat.open(); });
      answer.appendChild(b);
      keepDown();
    }

    // A returning visitor (the conversation follows them between pages) sees
    // where they left off, not the empty prompt.
    function restore(){
      var prev = Chat.last();
      if (!prev) return;
      chips.hidden = true;
      showQuestion(prev.question);
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
      addFullLink();
    }

    // Every turn, wherever it was asked (here or in the panel).
    function onTurn(type, d){
      if (type === 'turn') {
        voice.stop();
        pending = '';
        if (d.text === asking) input.value = '';
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
        // While a voice is speaking, the rings follow it instead.
        if (!voice.on() || !voice.speaking()) field.pulse(.55 + Math.random() * .45);
        pending = speakSentences(pending + d.delta);
      } else if (type === 'card') {
        addCard(d.card);
        if (d.card.kind === 'page') { page = d.card.page; setColour(d.svc); }
      } else if (type === 'done') {
        answer.removeAttribute('aria-busy');
        setBusy(false);
        if (pending.trim()) voice.say(pending);
        pending = '';
        addNext();
        addFullLink();
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
        addFullLink();
        if (d.text && d.text === asking) input.value = d.text;
        asking = '';
        answer.removeAttribute('aria-busy');
        setMode('idle');
      }
    }

    voice.hooks(
      function(){ field.pulse(.55 + Math.random() * .45); },
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

    chips.addEventListener('click', function(e){
      var b = e.target.closest('.hc-chip');
      if (Chat && b && !b.disabled) { asking = b.textContent.trim(); voice.unlock(); Chat.send(b.textContent); }
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (Chat) { asking = input.value.trim(); voice.unlock(); Chat.send(input.value); }
    });

    function placeholder(){ input.placeholder = small.matches ? PLACEHOLDER.small : PLACEHOLDER.wide; }
    placeholder();
    if (small.addEventListener) small.addEventListener('change', placeholder);

    // "Visible" for the header button and the nudge means a quarter of the console
    // is on screen; the field runs whenever any of it is.
    new IntersectionObserver(function(es){
      var e = es[es.length - 1];
      visible = e.intersectionRatio >= .25;
      field.run(e.isIntersecting);
    }, { threshold: [0, .25] }).observe(root);

    function wire(){
      Chat = window.DayamChat;
      if (!Chat || !Chat.on) { stage.hidden = true; return; }
      Chat.on(onTurn);
      Chat.setHero({
        visible: function(){ return visible; },
        focus: function(){ input.focus(); }
      });
      setBusy(Chat.busy());
      restore();
      // Back/forward cache: chat.js has reloaded the conversation; show where it is now.
      addEventListener('pagehide', function(){ voice.stop(); });
      addEventListener('pageshow', function(e){
        if (!e.persisted) return;
        voice.stop();
        pending = '';
        asking = '';
        answer.removeAttribute('aria-busy');
        answer.innerHTML = hintHTML;
        segEl = null;
        chips.hidden = false;
        setColour('');
        restore();
        setBusy(Chat.busy());
        setMode('idle');
      });
    }
    document.addEventListener('dayamchat:failed', function(){ stage.hidden = true; }, { once: true });
    if (window.DayamChat && window.DayamChat.send) wire();
    else document.addEventListener('dayamchat:ready', wire, { once: true });
  })();
})();
