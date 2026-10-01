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
    var ctx = cv.getContext('2d'), W = 0, H = 0, t = 0, last = 0, raf = 0, on = false;
    var mode = 'idle', energy = 0, target = 0, rgb = BLUE, rings = [], idleAt = 0;

    function size(){
      var d = Math.min(2, window.devicePixelRatio || 1);
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
    var mode = 'idle', visible = false, segEl = null, segText = '';
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
        input.value = '';
        chips.hidden = true;
        showQuestion(d.text);
        setColour('');
        setBusy(true);
        setMode('thinking');
      } else if (type === 'delta') {
        if (mode !== 'speaking') setMode('speaking');
        addText(d.delta);
        field.pulse(.55 + Math.random() * .45);
      } else if (type === 'card') {
        addCard(d.card);
        if (d.card.kind === 'page') setColour(d.svc);
      } else if (type === 'done') {
        setBusy(false);
        addFullLink();
        setMode('idle');
      } else if (type === 'error') {
        setBusy(false);
        segEl = null;
        addText(d.message);
        if (d.code !== 'reset') addCard({ kind: 'whatsapp', summary: '' });
        if (d.text) input.value = d.text;
        setMode('idle');
      }
    }

    // Until chat.js is ready the buttons wait. A disabled default button also
    // blocks Enter, so nothing is sent into the void.
    setColour('');
    setMode('idle');
    setBusy(true);

    chips.addEventListener('click', function(e){
      var b = e.target.closest('.hc-chip');
      if (Chat && b && !b.disabled) Chat.send(b.textContent);
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (Chat) Chat.send(input.value);
    });

    function placeholder(){ input.placeholder = small.matches ? PLACEHOLDER.small : PLACEHOLDER.wide; }
    placeholder();
    if (small.addEventListener) small.addEventListener('change', placeholder);

    // "Visible" for the header button and the nudge means a quarter of the console
    // is on screen; the field runs whenever any of it is.
    new IntersectionObserver(function(es){
      visible = es[0].intersectionRatio >= .25;
      field.run(es[0].isIntersecting);
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
    }
    if (window.DayamChat && window.DayamChat.send) wire();
    else document.addEventListener('dayamchat:ready', wire, { once: true });
  })();
})();
