/* Site chatbot: launcher, nudge and chat panel on every page.
   Talks to the Cloudflare Worker in chat-worker/ (POST /chat, streamed events),
   emails leads through the same FormSubmit endpoint as the contact form, and
   keeps the conversation in sessionStorage so it survives moving between pages.
   Spec: docs/superpowers/specs/2026-09-19-site-chatbot-design.md */
(function(){
  'use strict';

  // The deployed Worker (chat-worker/). Empty this to switch the widget off on the live site.
  var PROD_ENDPOINT = 'https://dayam-chat.dayam-chat-worker.workers.dev/chat';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ENDPOINT = LOCAL ? 'http://localhost:8787/chat' : PROD_ENDPOINT;
  if (!ENDPOINT || !window.fetch || !window.JSON || !document.currentScript) return;

  var SCRIPT = document.currentScript;
  var FORM_ACTION = 'https://formsubmit.co/ajax/dayaminsights@gmail.com';
  var WA = 'https://wa.me/917877640693?text=';
  var KEY = 'dayamChat';
  var STALL_MS = 20000;
  var DEFAULT_GREETING = 'Hi, I’m the Dayam Insights assistant. What can I help you with?';
  var ASK_ANYTHING = ['What do you build?', 'Talk to a person'];

  var PAGES = {
    '/index.html': { nudge: 'Not sure where to start? Tell me what’s slowing the business down.', chips: ['Reports take too long', 'We re-type orders', 'I need a website'] },
    '/dashboards.html': { nudge: 'Still building reports by hand? Ask me how a live dashboard would work for you.', chips: ['Our reports are manual', 'Our numbers never match', 'What does it connect to?'] },
    '/automation.html': { nudge: 'Typing the same order into three places? Ask me what we’d automate first.', chips: ['We re-type orders', 'Follow-ups get missed', 'Can AI answer customers?'] },
    '/ai-chatbot.html': { nudge: 'You’re looking at one. Ask me anything. This is the kind of chatbot we build.', chips: ['Is this a real AI?', 'Can it work on WhatsApp?', 'Can it use my price list?'] },
    '/websites.html': { nudge: 'Planning a new site? Ask me what it would take.', chips: ['Our site gets no enquiries', 'I need a new website', 'Will it show on Google?'] },
    '/how-we-work.html': { nudge: 'Question the page didn’t answer? Ask me.', chips: ['Where would we start?', 'How long does it take?', 'Do you work in the UAE?'] },
    '/faq.html': { nudge: 'Question the page didn’t answer? Ask me.', chips: ['Where would we start?', 'How long does it take?', 'Do you work in the UAE?'] },
    '/privacy.html': { nudge: '', chips: ASK_ANYTHING },
    '/404.html': { nudge: '', chips: ASK_ANYTHING }
  };
  var CARDS = {
    dashboards: { label: 'Dashboards & analytics', svc: 'svc-see' },
    automation: { label: 'Workflow automation', svc: 'svc-auto' },
    ai_assistants: { label: 'AI assistants for your team', svc: 'svc-auto' },
    chatbot: { label: 'AI chatbot for website & WhatsApp', svc: 'svc-auto' },
    websites: { label: 'Websites & digital', svc: 'svc-grow' },
    how_we_work: { label: 'How we work', svc: '' },
    faq: { label: 'Common questions', svc: '' },
    services: { label: 'Everything we build', svc: '' }
  };
  var LEAD_FIELDS = ['name', 'phone', 'business', 'city', 'country', 'sector', 'service', 'also', 'readiness', 'preferred_time', 'need_summary'];

  // GitHub Pages serves /websites and /websites.html alike; a 404 is served at any path.
  function pagePath(p){
    if (p === '/' || p === '') return '/index.html';
    if (PAGES[p]) return p;
    if (PAGES[p + '.html']) return p + '.html';
    return '/404.html';
  }
  var PATH = pagePath(location.pathname);
  var PAGE = PAGES[PATH];
  var phone = function(){ return window.matchMedia && matchMedia('(max-width: 599px)').matches; };
  var track = function(name, params){ if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); };

  // ===== State (sessionStorage, so the chat follows the visitor between pages) =====
  function fresh(){ return { history: [], sig: '', log: [], open: false, nudged: false, used: false, leads: [], suggested: [], greeting: '' }; }
  function load(){
    try { var s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && Array.isArray(s.history) && Array.isArray(s.log) ? s : null; }
    catch (e) { return null; }
  }
  function save(){ try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load() || fresh();

  // ===== Rendering =====
  function el(tag, cls, text){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // Only our own pages and WhatsApp become links; anything else stays plain text.
  function safeHref(url){
    var u;
    try { u = new URL(url, location.href); } catch (e) { return null; }
    if (u.protocol === 'https:' && u.hostname === 'wa.me') return u.href;
    var own = u.origin === location.origin || (u.protocol === 'https:' && (u.hostname === 'dayaminsights.com' || u.hostname === 'www.dayaminsights.com'));
    return own ? u.pathname + u.search + u.hash : null;
  }
  function inline(s){
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(m, label, url){
        var h = safeHref(url.replace(/&amp;/g, '&'));
        return h ? '<a href="' + esc(h) + '">' + label + '</a>' : label;
      });
  }
  // A small, escaped subset of markdown: paragraphs, bold, bullet lists, links.
  function md(text){
    return String(text).trim().split(/\n{2,}/).map(function(block){
      var lines = block.split('\n');
      if (lines.every(function(l){ return /^\s*[-*•]\s+/.test(l); })) {
        return '<ul>' + lines.map(function(l){ return '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  }

  var launch, dot, nudge, panel, logEl, chipsEl, form, input, sendBtn, typing, busy = false;

  function build(){
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    // The page loads this script with a version query; the stylesheet gets the same one,
    // so a change to either reaches returning visitors instead of waiting out the cache.
    css.href = SCRIPT.src.replace(/js\/chat\.js(\?.*)?$/, 'css/chat.css$1');
    document.head.appendChild(css);

    launch = el('button', 'dc-launch');
    launch.type = 'button';
    launch.setAttribute('aria-label', 'Talk to our AI agent');
    launch.setAttribute('aria-expanded', 'false');
    launch.setAttribute('aria-controls', 'dcPanel');
    launch.insertAdjacentHTML('beforeend', '<svg class="dc-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 1L14.4 9.6 23 12 14.4 14.4 12 23 9.6 14.4 1 12 9.6 9.6Z"/></svg>');
    launch.appendChild(el('span', 'dc-launch-label', 'Talk to our AI agent'));
    dot = el('span', 'dc-dot');
    dot.hidden = true;
    launch.appendChild(dot);

    panel = el('div', 'dc-panel');
    panel.id = 'dcPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'dcTitle');
    panel.innerHTML =
      '<div class="dc-head">' +
        '<span class="dc-sq" aria-hidden="true"></span>' +
        '<div class="dc-id"><p class="dc-title" id="dcTitle">Dayam Insights</p><p class="dc-sub">AI assistant · replies in seconds</p></div>' +
        '<button type="button" class="dc-new">New chat</button>' +
        '<button type="button" class="dc-close" aria-label="Close chat"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' +
      '<div class="dc-log" role="log" aria-live="polite"></div>' +
      '<div class="dc-chips"></div>' +
      '<form class="dc-form">' +
        '<label class="dc-sr" for="dcInput">Your message</label>' +
        '<textarea id="dcInput" class="dc-input" rows="1" maxlength="1000" placeholder="Type your message…"></textarea>' +
        '<button type="submit" class="dc-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
      '</form>' +
      '<p class="dc-foot">' +
        (PATH === '/ai-chatbot.html' ? 'You’re using one right now.' : '<a href="/ai-chatbot.html">This is the kind of chatbot we build →</a>') +
        ' · AI can make mistakes · <a href="/privacy.html#chatbot">Privacy</a>' +
      '</p>';

    logEl = panel.querySelector('.dc-log');
    chipsEl = panel.querySelector('.dc-chips');
    form = panel.querySelector('.dc-form');
    input = panel.querySelector('.dc-input');
    sendBtn = panel.querySelector('.dc-send');

    launch.addEventListener('click', function(){
      if (isOpen()) setOpen(false);
      else { track('chat_open', { source: 'launcher' }); setOpen(true); }
    });
    panel.querySelector('.dc-close').addEventListener('click', function(){ setOpen(false); });
    panel.querySelector('.dc-new').addEventListener('click', newChat);
    panel.addEventListener('keydown', function(e){ if (e.key === 'Escape') setOpen(false); });
    form.addEventListener('submit', function(e){ e.preventDefault(); send(input.value); });
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    });
    input.addEventListener('input', autosize);
    addEventListener('resize', function(){ document.documentElement.classList.toggle('dc-lock', isOpen() && phone()); });

    document.body.appendChild(panel);
    document.body.appendChild(launch);
  }

  function autosize(){
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  function scrollLog(){ logEl.scrollTop = logEl.scrollHeight; }

  function addBubble(who, text){
    var b = el('div', 'dc-msg dc-' + who);
    if (who === 'bot') b.innerHTML = md(text); else b.textContent = text;
    logEl.appendChild(b);
    scrollLog();
    return b;
  }
  function note(text){
    state.log.push({ who: 'bot', text: text });
    addBubble('bot', text);
  }

  function samePage(href){ return pagePath(href.split('#')[0]) === PATH; }
  function cardNode(card){
    var a;
    if (card.kind === 'page') {
      var meta = CARDS[card.page] || { label: 'Read more', svc: '' };
      a = el('a', 'dc-card ' + (meta.svc || 'dc-card-plain'));
      a.href = card.href;
      a.setAttribute('data-page', card.page);
      a.appendChild(el('span', 'dc-card-k', meta.label));
      if (card.reason) a.appendChild(el('span', 'dc-card-r', card.reason));
      a.appendChild(el('span', 'dc-card-go', samePage(card.href) ? 'Show me →' : 'See how it works →'));
      a.addEventListener('click', function(){
        track('chat_page_card', { page: card.page });
        if (phone()) setOpen(false, true);
      });
      return a;
    }
    a = el('a', 'dc-card dc-card-wa');
    a.href = WA + encodeURIComponent(card.summary || 'Hi Dayam Insights, I was chatting with the assistant on your website.');
    a.target = '_blank';
    a.rel = 'noopener';
    a.appendChild(el('span', 'dc-card-k', 'Continue on WhatsApp'));
    a.appendChild(el('span', 'dc-card-r', '+91 78776 40693 · a person replies'));
    a.appendChild(el('span', 'dc-card-go', 'Open WhatsApp →'));
    return a;
  }
  function addCard(card){
    state.log.push({ who: 'card', card: card });
    if (card.kind === 'page') state.suggested.push(card.page);
    logEl.appendChild(cardNode(card));
    placeCta();
    scrollLog();
  }

  // Under the latest page card, until the visitor has left details: a way to hand them over
  // even when the model's message forgot to ask (it does, now and then).
  function placeCta(){
    var old = logEl.querySelector('.dc-cta');
    if (old) old.remove();
    var cards = logEl.querySelectorAll('.dc-card[data-page]');
    if (state.leads.length || !cards.length) return;
    var b = el('button', 'dc-chip dc-cta', 'Ask the team to get in touch');
    b.type = 'button';
    b.addEventListener('click', function(){
      if (busy) return;
      b.remove();
      send('I’d like the team to get in touch.');
    });
    cards[cards.length - 1].insertAdjacentElement('afterend', b);
  }

  function showTyping(on){
    if (on && !typing) {
      typing = el('div', 'dc-typing');
      typing.setAttribute('aria-label', 'The assistant is typing');
      typing.innerHTML = '<i></i><i></i><i></i>';
      logEl.appendChild(typing);
      scrollLog();
    } else if (!on && typing) {
      typing.remove();
      typing = null;
    }
  }

  function renderChips(){
    chipsEl.innerHTML = '';
    var asked = state.log.some(function(e){ return e.who === 'me'; });
    chipsEl.hidden = asked || !PAGE.chips.length;
    if (chipsEl.hidden) return;
    PAGE.chips.forEach(function(c){
      var b = el('button', 'dc-chip', c);
      b.type = 'button';
      b.addEventListener('click', function(){ send(c); });
      chipsEl.appendChild(b);
    });
  }

  function greet(line){
    state.greeting = line;
    note(line);
    renderChips();
    save();
  }

  function isOpen(){ return panel && !panel.hidden; }
  function setOpen(open, quiet){
    panel.hidden = !open;
    launch.setAttribute('aria-expanded', String(open));
    openers.forEach(function(b){ b.setAttribute('aria-expanded', String(open)); });
    document.documentElement.classList.toggle('dc-lock', open && phone());
    state.open = open;
    save();
    if (open) {
      hideNudge();
      setUnread(false);
      if (!state.log.length) greet(state.greeting || PAGE.nudge || DEFAULT_GREETING);
      scrollLog();
      if (!quiet) input.focus({ preventScroll: true });
    } else if (!quiet) {
      launch.focus({ preventScroll: true });
    }
  }

  function newChat(){
    state = fresh();
    state.used = true;
    state.nudged = true;
    state.open = true;
    logEl.innerHTML = '';
    greet(PAGE.nudge || DEFAULT_GREETING);
    input.focus({ preventScroll: true });
  }

  // ===== Talking to the Worker =====
  function parseSSE(buf){
    var parts = buf.split('\n\n'), rest = parts.pop(), events = [];
    parts.forEach(function(chunk){
      var ev = 'message', data = '';
      chunk.split('\n').forEach(function(line){
        if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
        else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
      });
      if (!data) return;
      try { events.push({ event: ev, data: JSON.parse(data) }); } catch (e) {}
    });
    return { events: events, rest: rest };
  }

  // POST one turn and feed its events to `on` as they stream. Resolves when the
  // stream ends; rejects with {code} on an HTTP error, an error event or a stall.
  function stream(payload, on){
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer, failure = null, buf = '';
    function arm(){ clearTimeout(timer); timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, STALL_MS); }
    function take(chunk, final){
      buf += chunk;
      if (final) buf += '\n\n';
      var p = parseSSE(buf);
      buf = p.rest;
      p.events.forEach(function(ev){
        if (ev.event === 'error') failure = { code: (ev.data && ev.data.code) || 'unavailable' };
        else if (on[ev.event]) on[ev.event](ev.data);
      });
    }
    arm();
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function(r){
      if (!r.ok) {
        return r.json().catch(function(){ return {}; }).then(function(j){ throw { code: j.error || 'unavailable' }; });
      }
      if (!r.body || !r.body.getReader || !window.TextDecoder) return r.text().then(function(t){ take(t, true); });
      var reader = r.body.getReader(), dec = new TextDecoder();
      return (function pump(){
        return reader.read().then(function(x){
          if (x.done) { take(dec.decode(), true); return; }
          arm();
          take(dec.decode(x.value, { stream: true }), false);
          return pump();
        });
      })();
    }).then(function(){
      clearTimeout(timer);
      if (failure) throw failure;
    }, function(e){
      clearTimeout(timer);
      throw (e && e.code) ? e : { code: 'unavailable' };
    });
  }

  function send(text){
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true;
    sendBtn.disabled = true;
    state.used = true;
    chipsEl.hidden = true;
    var meBubble = addBubble('me', text);
    state.log.push({ who: 'me', text: text });
    input.value = '';
    autosize();
    save();
    track('chat_message');

    var payload = { history: state.history, input: text, page: { path: PATH, title: document.title } };
    if (state.sig) payload.sig = state.sig;
    if (!state.history.length && state.greeting) payload.page.greeting = state.greeting;

    // The reply streams into `bot`; `botEntry` is its log entry, held by reference
    // because a lead-email failure note can land in the log mid-stream.
    var bot = null, botEntry = null, botText = '', answered = false, gotDone = false;
    function closeBot(){ bot = null; botEntry = null; }
    logEl.setAttribute('aria-busy', 'true');
    showTyping(true);

    stream(payload, {
      text: function(d){
        showTyping(false);
        answered = true;
        if (!bot) {
          bot = addBubble('bot', '');
          botEntry = { who: 'bot', text: '' };
          botText = '';
          state.log.push(botEntry);
        }
        botText += d.delta;
        botEntry.text = botText;
        bot.innerHTML = md(botText);
        scrollLog();
      },
      card: function(d){
        closeBot();
        showTyping(false);
        addCard(d);
        showTyping(true);
      },
      lead: function(d){ sendLead(d); },
      done: function(d){
        gotDone = true;
        state.history = state.history.concat(d.append || []);
        state.sig = d.sig || '';
      }
    }).then(function(){
      if (!gotDone) throw { code: 'unavailable' };
    }).catch(function(err){
      showTyping(false);
      fail((err && err.code) || 'unavailable', text, answered ? null : meBubble);
    }).then(function(){
      showTyping(false);
      logEl.removeAttribute('aria-busy');
      busy = false;
      sendBtn.disabled = false;
      save();
      if (!isOpen()) setUnread(true);
    });
  }

  function contactHref(){ return document.getElementById('contact') ? '#contact' : '/index.html#contact'; }

  // The turn did not complete. Keep the visitor's words and always leave a way to a person.
  function fail(code, text, meBubble){
    if (code === 'reset') {
      state = fresh();
      state.used = true;
      state.nudged = true;
      state.open = isOpen();
      logEl.innerHTML = '';
      note('Sorry, I had to restart our chat. Could you send that again?');
      input.value = text;
      autosize();
      return;
    }
    if (meBubble) {
      meBubble.remove();
      for (var i = state.log.length - 1; i >= 0; i--) {
        if (state.log[i].who === 'me') { state.log.splice(i, 1); break; }
      }
      input.value = text;
      autosize();
    }
    note(code === 'rate_limited' || code === 'limit_reached'
      ? 'That’s more messages than I can take right now. The quickest way on from here is a person: WhatsApp us, or [use the contact form](' + contactHref() + ').'
      : 'I can’t answer right now. You can reach a person on WhatsApp, or [use the contact form](' + contactHref() + ').');
    addCard({ kind: 'whatsapp', summary: '' });
  }

  // ===== Leads: the same FormSubmit endpoint as the contact form =====
  function transcript(){
    return state.log.map(function(e){
      if (e.who === 'card') return e.card.kind === 'page' ? '[Page card: ' + ((CARDS[e.card.page] || {}).label || e.card.page) + ']' : '[WhatsApp button]';
      return (e.who === 'me' ? 'Visitor: ' : 'Assistant: ') + e.text;
    }).join('\n');
  }

  function sendLead(lead){
    var key = JSON.stringify(lead);
    if (state.leads.indexOf(key) !== -1) return;
    var update = state.leads.length > 0;
    state.leads.push(key);
    save();
    placeCta();
    var fd = new FormData();
    fd.append('_subject', (update ? 'Chatbot lead update · ' : 'Chatbot lead · ') +
      String(lead.readiness || '').toUpperCase() + ' · ' + (lead.service || '') + ' · ' + (lead.name || ''));
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    LEAD_FIELDS.forEach(function(k){
      var v = lead[k];
      if (v != null && v !== '') fd.append(k, Array.isArray(v) ? v.join(', ') : String(v));
    });
    fd.append('page', PATH);
    fd.append('pages_suggested', state.suggested.join(', '));
    fd.append('transcript', transcript());
    (function attempt(n){
      fetch(FORM_ACTION, { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd })
        .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); })
        .then(function(){ track('generate_lead', { method: 'chatbot', intent: lead.service, readiness: lead.readiness }); })
        .catch(function(){
          if (n > 1) return attempt(n - 1);
          note('I couldn’t pass your details to the team just now. Send them on WhatsApp and a person will pick it up:');
          addCard({ kind: 'whatsapp', summary: 'Hi Dayam Insights, I’m ' + (lead.name || '') + '. ' + (lead.need_summary || '') });
          save();
        });
    })(2);
  }

  // ===== Stay out of the way =====
  // The contact form is the page's own way in: the nudge never lands on top of
  // it, and one already showing leaves when the form scrolls into view. On a
  // phone the launcher sits over the hero's controls (the homepage index, a
  // service page's video and its pause button) and over the form's own fields,
  // so it steps aside while either is on screen.
  // Read on demand rather than from the observer: the half-page trigger fires
  // inside the same scroll event that brings the form in, before any observer
  // callback has run.
  function formOnScreen(){
    var f = document.querySelector('.contact-form');
    if (!f) return false;
    var r = f.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  }
  function watchPage(){
    if (!('IntersectionObserver' in window)) return;
    var heroIn = false, formIn = false;
    function tuck(){ launch.classList.toggle('dc-tucked', (heroIn || formIn) && phone() && !isOpen()); }
    var form = document.querySelector('.contact-form');
    if (form) new IntersectionObserver(function(es){
      formIn = es[0].isIntersecting;
      if (formIn) hideNudge();
      tuck();
    }).observe(form);
    var hero = document.querySelector('.hero-stage, .page-hero .hero-video');
    if (hero) new IntersectionObserver(function(es){
      heroIn = es[0].isIntersecting;
      tuck();
    }).observe(hero);
  }

  // ===== Nudge: once per visit, after 20 s or half the page =====
  function armNudge(){
    if (!PAGE.nudge || state.nudged || state.used || state.log.length) return;
    var fired = false, t;
    function onScroll(){
      var max = document.documentElement.scrollHeight - innerHeight;
      if (max > 0 && scrollY / max >= 0.5) fire();
    }
    function fire(){
      if (fired) return;
      // Over the form: try again once it has scrolled away.
      if (formOnScreen()) { clearTimeout(t); t = setTimeout(fire, 6000); return; }
      fired = true;
      clearTimeout(t);
      removeEventListener('scroll', onScroll);
      if (isOpen() || state.used) return;
      state.nudged = true;
      save();
      showNudge();
    }
    t = setTimeout(fire, 20000);
    addEventListener('scroll', onScroll, { passive: true });
  }
  function showNudge(){
    nudge = el('div', 'dc-nudge');
    var open = el('button', 'dc-nudge-text', PAGE.nudge);
    open.type = 'button';
    var x = el('button', 'dc-nudge-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    open.addEventListener('click', function(){ track('chat_open', { source: 'nudge' }); setOpen(true); });
    x.addEventListener('click', hideNudge);
    nudge.appendChild(open);
    nudge.appendChild(x);
    document.body.appendChild(nudge);
  }
  function hideNudge(){ if (nudge) { nudge.remove(); nudge = null; } }

  // ===== Start =====
  function restore(){
    logEl.innerHTML = '';
    state.log.forEach(function(e){
      if (e.who === 'card') logEl.appendChild(cardNode(e.card));
      else addBubble(e.who, e.text);
    });
    placeCta();
    renderChips();
    if (state.open) {
      if (phone()) { state.open = false; save(); setUnread(true); }
      else setOpen(true, true);
    }
  }

  // ===== "Ask us" in the header and the phone menu =====
  // The pages carry the buttons hidden (without this script they would open
  // nothing); they open the same panel as the corner launcher and share its
  // unread dot. From the phone menu, the menu closes first so the panel is not
  // stacked on top of it.
  var openers = [];
  function wireOpeners(){
    openers = Array.prototype.slice.call(document.querySelectorAll('[data-chat-open]'));
    openers.forEach(function(b){
      b.hidden = false;
      b.setAttribute('aria-controls', 'dcPanel');
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function(){
        var toggle = document.getElementById('navToggle');
        if (toggle && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
        if (isOpen()) { setOpen(false); return; }
        track('chat_open', { source: b.closest('.mm-cta') ? 'menu' : 'nav' });
        setOpen(true);
      });
    });
  }
  function setUnread(on){
    dot.hidden = !on;
    openers.forEach(function(b){
      var d = b.querySelector('.nav-ask-dot');
      if (d) d.hidden = !on;
    });
  }

  function init(){
    build();
    wireOpeners();
    restore();
    watchPage();
    armNudge();
    // Back/forward cache: another page may have moved the conversation on.
    addEventListener('pageshow', function(e){
      if (!e.persisted) return;
      var s = load();
      if (s) { state = s; restore(); }
    });
    window.DayamChat = { md: md, parseSSE: parseSSE, safeHref: safeHref, state: function(){ return state; } };
  }

  function whenIdle(fn){
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 1);
  }
  if (document.readyState === 'complete') whenIdle(init);
  else addEventListener('load', function(){ whenIdle(init); });
})();
