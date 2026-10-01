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
      var cell = 20, cx = W / 2, cy = H / 2, reach = Math.min(W, H) * .75, sweep = t * 3.2;
      for (var y = 0; y <= H / cell + 1; y++) for (var x = 0; x <= W / cell + 1; x++) {
        var px = x * cell, py = y * cell, dx = px - cx, dy = py - cy, d = Math.sqrt(dx * dx + dy * dy);
        var v = ringsAt(d);
        if (mode === 'thinking' && !reduce) {
          var da = Math.abs(((Math.atan2(dy, dx) - sweep) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
          v += Math.max(0, 1 - da * 2.2) * Math.max(0, 1 - d / (reach * .8)) * .7;
        }
        v += Math.max(0, 1 - d / (34 + energy * 20)) * (.6 + energy * .4);   // the core
        v += .04 + .03 * Math.sin(x * .7 + y * 1.3 + t * .8);                // the breath
        v = Math.min(1, v) * Math.max(0, 1 - d / reach);
        var s = 2 + v * 6;
        ctx.fillStyle = v > .28 ? 'rgba(' + rgb + ',' + (.2 + v * .8) + ')' : 'rgba(159,176,200,' + (.06 + v * .9) + ')';
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
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
    var on = false, queue = [], busy = false, onWord = function(){}, onDone = function(){};
    try { on = ok && sessionStorage.getItem(VOICE_KEY) === '1'; } catch (e) {}
    if (ok) synth.getVoices();   // Chrome loads the list lazily; ask early.

    function lang(text){ return /[\u0900-\u097F]/.test(text) ? 'hi' : /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en'; }
    function pick(code){
      var all = synth.getVoices().filter(function(v){ return String(v.lang).toLowerCase().indexOf(code) === 0; });
      for (var i = 0; i < PREFER[code].length; i++) {
        for (var j = 0; j < all.length; j++) if (PREFER[code][i].test(all[j].name)) return all[j];
      }
      return all[0] || null;
    }
    // What a person would read aloud: link text without the URL, no markdown marks.
    function plain(s){
      return String(s).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
        .replace(/[*_`#>]/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim();
    }
    function next(){
      if (busy) return;
      if (!queue.length) { onDone(); return; }
      var text = queue.shift(), v = pick(lang(text));
      if (!v) { next(); return; }
      var u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.onboundary = function(e){ if (!e.name || e.name === 'word') onWord(); };
      u.onend = u.onerror = function(){ busy = false; next(); };
      busy = true;
      synth.speak(u);
    }
    return {
      supported: ok,
      on: function(){ return on; },
      set: function(yes){
        on = ok && !!yes;
        try { sessionStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch (e) {}
        if (!on) this.stop();
      },
      say: function(sentence){
        if (!on) return;
        var s = plain(sentence);
        if (s) { queue.push(s); next(); }
      },
      stop: function(){ queue = []; busy = false; if (ok) synth.cancel(); },
      speaking: function(){ return busy || queue.length > 0; },
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
    function speakSentences(buf){
      var re = /([.!?।؟]+["”’)]*)\s+|\n+/g, m, cut = 0;
      while ((m = re.exec(buf))) {
        voice.say(buf.slice(cut, m.index + (m[1] ? m[1].length : 0)));
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
          if (e.card.kind === 'page') setColour(Chat.svc(e.card));
        } else if (e.who === 'bot') {
          segEl = null;
          addText(e.text);
        }
      });
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
        showQuestion(d.text);
        setColour('');
        setBusy(true);
        setMode('thinking');
      } else if (type === 'delta') {
        if (mode !== 'speaking') setMode('speaking');
        addText(d.delta);
        // With the voice on, the rings follow the spoken words instead.
        if (!voice.on()) field.pulse(.55 + Math.random() * .45);
        pending = speakSentences(pending + d.delta);
      } else if (type === 'card') {
        addCard(d.card);
        if (d.card.kind === 'page') setColour(d.svc);
      } else if (type === 'done') {
        answer.removeAttribute('aria-busy');
        setBusy(false);
        if (pending.trim()) voice.say(pending);
        pending = '';
        addFullLink();
        asking = '';
        if (!voice.speaking()) setMode('idle');
      } else if (type === 'error') {
        voice.stop();
        pending = '';
        setBusy(false);
        segEl = null;
        addText(d.message);
        if (d.code !== 'reset') addCard({ kind: 'whatsapp', summary: '' });
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
      spk.setAttribute('aria-pressed', String(voice.on()));
    });

    // Until chat.js is ready the buttons wait. A disabled default button also
    // blocks Enter, so nothing is sent into the void.
    setColour('');
    setMode('idle');
    setBusy(true);

    chips.addEventListener('click', function(e){
      var b = e.target.closest('.hc-chip');
      if (Chat && b && !b.disabled) { asking = b.textContent.trim(); Chat.send(b.textContent); }
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (Chat) { asking = input.value.trim(); Chat.send(input.value); }
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
