(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sticky nav border + scroll progress bar, batched in one rAF
  var nav = document.querySelector('header.nav');
  var scrollBar = document.getElementById('scrollBar');
  var ticking = false;

  // Cached on init, resize and load; the scroll loop never reads layout.
  var docScrollMax = 0;
  function measureDocument(){
    docScrollMax = document.documentElement.scrollHeight - window.innerHeight;
  }

  function onFrame(){
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 8);

    var frac = docScrollMax > 0 ? Math.min(1, y / docScrollMax) : 0;
    scrollBar.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
    if (typeof updateSpy === 'function') updateSpy();
    if (typeof updateProcess === 'function') updateProcess();
    if (typeof updateSignal === 'function') updateSignal();

    ticking = false;
  }
  function onScroll(){
    if (!ticking){ requestAnimationFrame(onFrame); ticking = true; }
  }
  measureDocument();
  onFrame();
  window.addEventListener('scroll', onScroll, {passive:true});
  // Re-measure once webfonts have settled: font swap changes both text widths
  // and document height.
  window.addEventListener('load', function(){
    measureDocument();
    onFrame();
  });

  window.addEventListener('resize', function(){
    measureDocument();
  }, {passive:true});

  // iOS Safari only applies :active while some touchstart listener exists.
  // The CSS turns the grey tap flash off and gives presses their own :active
  // states instead, so without this an iPhone tap would show nothing at all.
  document.body.addEventListener('touchstart', function(){}, {passive:true});

  // Footer year
  document.getElementById('yr').textContent = new Date().getFullYear();

  // Reveal on scroll
  var reveals = document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right, .web-visual');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function(el){ el.classList.add('in'); });
  } else {
    var ro = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){
          e.target.classList.add('in');
          ro.unobserve(e.target);
        }
      });
    }, {threshold:.14, rootMargin:'0px 0px -8% 0px'});
    reveals.forEach(function(el){ ro.observe(el); });
  }

  // Animated counters
  // Indian digit grouping: 48200 -> "48,200", 1240000 -> "12,40,000".
  // Applied to any whole number >= 1000, so rupee figures and reach counts
  // read the way this audience actually writes them.
  var groupFmt = new Intl.NumberFormat('en-IN');
  function fmt(n, dec){
    if (dec > 0) return n.toFixed(dec);
    var v = Math.round(n);
    return v >= 1000 ? groupFmt.format(v) : String(v);
  }

  function animateCount(el){
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec')||'0',10);
    var prefix = el.getAttribute('data-prefix')||'';
    var suffix = el.getAttribute('data-suffix')||'';
    if (reduce){ el.textContent = prefix + fmt(target, dec) + suffix; return; }
    // The hero dashboard does not exist on screen until ~1.15s, so its
    // figures would otherwise finish counting behind a panel nobody can see.
    var hold = parseInt(el.getAttribute('data-delay')||'0',10);
    if (hold > 0){
      el.removeAttribute('data-delay');
      setTimeout(function(){ animateCount(el); }, hold);
      return;
    }
    var start = null, dur = 900;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts-start)/dur, 1);
      var eased = 1 - Math.pow(1-p, 3);
      el.textContent = prefix + fmt(target*eased, dec) + suffix;
      if(p<1) requestAnimationFrame(step);
      else el.textContent = prefix + fmt(target, dec) + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (!('IntersectionObserver' in window)){
    counters.forEach(animateCount);
  } else {
    var co = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ animateCount(e.target); co.unobserve(e.target); }
      });
    }, {threshold:.6});
    counters.forEach(function(el){ co.observe(el); });
  }

  // ===== Process: current / completed / not yet =====
  // The brief for this section is a system, not four cards, so a step that
  // has been passed has to look different from one still ahead. Reaching a
  // step marks every earlier one done and drives the connecting rule's fill
  // to that fraction — which keeps the whole thing to one observer and no
  // scroll maths.
  var steps = Array.prototype.slice.call(document.querySelectorAll('.proc'));
  var procGrid = document.querySelector('.proc-grid');
  var procTop = 0, procDone = -2;

  function setProcess(i, fill){
    procGrid.style.setProperty('--pp', fill);
    if (i === procDone) return;          // classes only touched when they change
    procDone = i;
    steps.forEach(function(el, j){
      el.classList.toggle('active', j === i);
      el.classList.toggle('done', j < i);
    });
  }
  function measureProcess(){
    if (!procGrid) return;
    procTop = procGrid.getBoundingClientRect().top + window.scrollY;
  }
  // The four steps sit side by side, so every one of them enters the viewport
  // in the same frame — a per-step observer marks the row finished before the
  // reader has looked at it. Progress is taken from the row's own travel up
  // the viewport instead: it starts filling as the row appears and completes
  // as it reaches the reading line.
  function updateProcess(){
    if (!procGrid || !steps.length) return;
    var start = procTop - window.innerHeight * 0.82;
    var end   = procTop - window.innerHeight * 0.34;
    var p = end > start ? (window.scrollY - start) / (end - start) : 1;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    setProcess(Math.min(steps.length - 1, Math.floor(p * steps.length)), p);
  }
  if (!procGrid || !steps.length || reduce){
    if (procGrid){ procGrid.style.setProperty('--pp', 1); }
    steps.forEach(function(el){ el.classList.add('active'); });
    updateProcess = function(){};
  } else {
    measureProcess();
  }

  // ===== Signal: scattered -> collected -> plotted -> pattern -> acted on =====
  // The picture is tied to scroll position rather than stepped between
  // states, so the reader is scrubbing it: pause halfway and the dots sit
  // halfway. Scroll is never intercepted or retimed — the page scrolls
  // exactly as far as the wheel says, and only the drawing reacts. That is
  // the difference between scroll-linked and scroll-jacking, and it is what
  // keeps this usable for people who get motion sick.
  //
  // Per frame this writes five numbers and, only when it changes, one
  // attribute. No layout is read in the loop; offsets are cached beside the
  // other scroll caches. All five numbers land on transform/opacity only.
  var signal = document.getElementById('signal');
  var sySteps = signal ? Array.prototype.slice.call(signal.querySelectorAll('.sy-step')) : [];
  var syWrap = signal ? signal.querySelector('.sy-steps') : null;
  var syFrom = 0, syTo = 1, syStage = 0, syScrub = false;
  var syWide = window.matchMedia('(min-width:901px)');

  // Smoothstep. A phase driven linearly off scroll starts and stops with a
  // hard edge; easing each phase's local progress is what makes the dots
  // settle rather than arrive.
  function seg(p, a, b){
    var t = (p - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }
  function syVars(t1, t2, t3, t4, t5){
    var s = signal.style;
    s.setProperty('--t1', t1); s.setProperty('--t2', t2); s.setProperty('--t3', t3);
    s.setProperty('--t4', t4); s.setProperty('--t5', t5);
  }
  function syMark(stage){
    if (stage === syStage) return;      // classes and attribute only on change
    syStage = stage;
    signal.setAttribute('data-stage', String(stage));
    sySteps.forEach(function(el, i){ el.classList.toggle('is-on', i === stage - 1); });
  }
  // The finished frame with every step legible: the state for anyone not
  // scrubbing — reduced motion, or a screen too small to pin a sticky column.
  function syStatic(){
    syVars(1, 1, 1, 1, 1);
    signal.setAttribute('data-stage', '5');
    syStage = 5;
    sySteps.forEach(function(el){ el.classList.add('is-on'); });
  }
  function measureSignal(){
    if (!syWrap || !syScrub) return;
    var r = syWrap.getBoundingClientRect();
    var top = r.top + window.scrollY;
    var stepH = r.height / sySteps.length;
    // Progress runs from the first step sitting at the viewport's centre to
    // the last one sitting there, so step N centred always means phase N.
    syFrom = top + stepH * 0.5 - window.innerHeight * 0.5;
    syTo   = top + r.height - stepH * 0.5 - window.innerHeight * 0.5;
  }
  function updateSignal(){
    if (!syScrub) return;
    var p = syTo > syFrom ? (window.scrollY - syFrom) / (syTo - syFrom) : 1;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    // Windows overlap on purpose: the line starts drawing while the last
    // points are still landing, the way it would if you were watching it
    // happen rather than watching five slides.
    syVars(seg(p,.03,.26), seg(p,.30,.52), seg(p,.42,.60), seg(p,.56,.76), seg(p,.78,.95));
    syMark(Math.min(5, Math.max(1, Math.round(p * 4) + 1)));
  }
  function syApply(){
    syScrub = !!signal && !reduce && sySteps.length > 0 && syWide.matches;
    if (!signal) return;
    if (syScrub){ measureSignal(); updateSignal(); }
    else syStatic();
  }
  if (signal){
    syApply();
    // addEventListener on MediaQueryList is the modern form; addListener is
    // the fallback for Safari before 14.
    if (syWide.addEventListener) syWide.addEventListener('change', syApply);
    else if (syWide.addListener) syWide.addListener(syApply);
  }

  // CTA / contact-intent tracking: fire a GA4 lead event on any primary
  // button or mailto/WhatsApp link click. Safe no-op if gtag isn't loaded.
  document.addEventListener('click', function(e){
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var isContact = href.indexOf('mailto:') === 0 || href.indexOf('wa.me') !== -1 || href.indexOf('api.whatsapp.com') !== -1;
    var isPrimary = link.classList.contains('btn-primary');
    if (!isContact && !isPrimary) return;
    if (typeof window.gtag === 'function'){
      window.gtag('event', 'generate_lead', {
        method: href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp') !== -1 ? 'whatsapp'
              : href.indexOf('mailto:') === 0 ? 'email' : 'cta_click',
        label: (link.textContent || '').trim().slice(0, 60)
      });
    }
  }, true);

  // ===== Hero videos (service pages) =====
  // No autoplay attribute: the script starts each loop, so reduced motion and
  // no-JS both keep the poster — which is the finished frame, so nothing is
  // lost. A loop pauses while it is off screen, and the button is the pause
  // control WCAG 2.2.2 asks for on motion longer than five seconds. Reduced
  // motion starts paused but can still choose to play.
  Array.prototype.forEach.call(document.querySelectorAll('.hero-video'), function(fig){
    var v = fig.querySelector('video'), btn = fig.querySelector('.hv-toggle');
    if (!v) return;
    v.muted = true;                 // a property, not just the attribute, or some browsers refuse to start it
    // The poster is a moment inside the loop (2.4s, the "before" just framed,
    // not the blue-square opening), so playback starts there instead of at 0 —
    // otherwise the still would jump to a different frame the instant the
    // video took over. A seek only sticks once the browser has the metadata
    // (Edge silently drops one set earlier), so it happens on the way into the
    // first play.
    var from = parseFloat(v.getAttribute('data-start')) || 0, seeked = !(from > 0);
    var held = reduce, visible = false;
    // preload="metadata" in the markup keeps phones on the poster (a few
    // hundred KB at most). A wide viewport on an unmetered line may fetch
    // ahead so the first seconds are buffered when the loop starts; data
    // saver and 2G/3G start paused on the poster — the finished frame — with
    // the play control still offered.
    var conn = navigator.connection || {};
    var slow = !!conn.saveData || /^(slow-2g|2g|3g)$/.test(conn.effectiveType || '');
    if (slow) held = true;
    else if (window.matchMedia('(min-width: 1000px)').matches) v.preload = 'auto';
    function sync(){
      fig.classList.toggle('is-paused', held);
      if (btn){
        btn.setAttribute('aria-pressed', String(held));
        btn.setAttribute('aria-label', held ? 'Play animation' : 'Pause animation');
      }
    }
    function start(){
      if (!seeked){
        if (v.readyState >= 1){ v.currentTime = from; seeked = true; }
        else {
          v.addEventListener('loadedmetadata', function(){ v.currentTime = from; seeked = true; if (!held && visible) start(); }, { once: true });
          return;
        }
      }
      var pr = v.play();
      // Autoplay refused (data saver, power mode): show the play control rather than a frozen frame with a pause button.
      if (pr && pr.catch) pr.catch(function(){ held = true; sync(); });
    }
    function apply(){ if (!held && visible) start(); else v.pause(); }
    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        entries.forEach(function(e){ visible = e.isIntersecting; apply(); });
      }, { threshold: .2 }).observe(fig);
    } else { visible = true; apply(); }
    if (btn) btn.addEventListener('click', function(){ held = !held; sync(); apply(); });
    sync();
  });

  // ===== Mobile menu =====
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  if (navToggle && mobileMenu){
    var setMenu = function(open){
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileMenu.hidden = !open;
      // Stop the page scrolling behind a full-height open menu.
      document.body.style.overflow = open ? 'hidden' : '';
    };
    navToggle.addEventListener('click', function(){
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    // Any in-page link closes the menu before the scroll happens.
    mobileMenu.addEventListener('click', function(e){
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true'){
        setMenu(false);
        navToggle.focus();
      }
    });
    // Crossing back to desktop width with the menu open would otherwise
    // strand body{overflow:hidden} on a desktop layout.
    window.addEventListener('resize', function(){
      if (window.innerWidth > 1023 && navToggle.getAttribute('aria-expanded') === 'true') setMenu(false);
    }, {passive:true});
  }


  // ===== Contact form =====
  // action= points at FormSubmit. With JS we post to its /ajax/ endpoint so
  // the visitor stays on the page and sees .cf-success in place of the form.
  // If the request fails (offline, blocked, FormSubmit down) we fall back to
  // a native POST, which lands on FormSubmit and bounces back to ?sent=1 via
  // the _next field — so the form is never a dead end.
  var contactForm = document.querySelector('.contact-form');
  var contactDone = document.querySelector('.cf-success');

  // ===== Contact form: the intent router =====
  // The last field used to ask one question ("what takes the most time right
  // now?") that only an operations visitor could answer. The select rewrites
  // that question — label and placeholder — to match what the visitor came
  // for, so the form never asks somebody to describe a problem they do not
  // have. Any CTA carrying data-intent presets the select before the jump,
  // which keeps the promise of "Build my website" intact on arrival.
  var cfIntent = document.getElementById('cfIntent');
  var cfMessage = contactForm && contactForm.querySelector('.cf-message');
  function applyIntent(){
    if (!cfIntent || !cfMessage) return;
    var opt = cfIntent.options[cfIntent.selectedIndex];
    if (!opt) return;
    var span = cfMessage.querySelector('span');
    var area = cfMessage.querySelector('textarea');
    if (span) span.textContent = opt.getAttribute('data-label') || cfIntent.getAttribute('data-default-label') || span.textContent;
    if (area) area.placeholder = opt.getAttribute('data-hint') || cfIntent.getAttribute('data-default-hint') || area.placeholder;
  }
  if (cfIntent){
    cfIntent.addEventListener('change', applyIntent);
    // A select can survive a reload with the visitor's last choice.
    applyIntent();
    document.addEventListener('click', function(e){
      var link = e.target.closest('a[data-intent]');
      if (!link) return;
      var want = link.getAttribute('data-intent');
      for (var i = 0; i < cfIntent.options.length; i++){
        if (cfIntent.options[i].value === want){ cfIntent.selectedIndex = i; applyIntent(); break; }
      }
    }, true);
  }

  function showContactDone(){
    if (!contactForm || !contactDone) return;
    contactForm.hidden = true;
    contactDone.hidden = false;
    contactDone.focus({ preventScroll: true });
    // The form was taller than the message, so on a phone the message's top
    // (the "Thanks") ends up above the screen or under the sticky header.
    // Bring it clear, leaving the same room under the header as html's
    // scroll-padding-top. Measured from layout (offsetTop), not from the box on
    // screen: that is still 8px low from the entrance and would settle short.
    if (contactDone.getBoundingClientRect().top < nav.offsetHeight){
      var y = 0;
      for (var el = contactDone; el; el = el.offsetParent) y += el.offsetTop;
      var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      window.scrollTo({ top: y - pad, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  if (contactForm){
    var cfSubmit = contactForm.querySelector('.cf-submit');
    var cfNote = contactForm.querySelector('.cf-note');
    var cfBusy = false;

    contactForm.addEventListener('submit', function(e){
      var action = contactForm.getAttribute('action') || '';
      var ajax = action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      if (ajax === action || typeof window.fetch !== 'function') return; // not FormSubmit, or no fetch: native post
      e.preventDefault();
      if (cfBusy) return;
      cfBusy = true;
      if (cfSubmit) cfSubmit.disabled = true;
      var label = cfSubmit ? cfSubmit.innerHTML : '';
      if (cfSubmit) cfSubmit.textContent = 'Sending…';

      fetch(ajax, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(contactForm)
      }).then(function(r){
        return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status));
      }).then(function(){
        if (typeof window.gtag === 'function'){
          window.gtag('event', 'generate_lead', { method: 'form', intent: cfIntent ? cfIntent.value : '' });
        }
        showContactDone();
      }).catch(function(){
        // Network or service failure: let the browser do a plain POST.
        cfBusy = false;
        if (cfSubmit){ cfSubmit.disabled = false; cfSubmit.innerHTML = label; }
        if (cfNote) cfNote.textContent = 'Couldn’t send from here — trying the long way round…';
        contactForm.submit();
      });
    });

    // Came back from the no-JS path (FormSubmit redirected to _next).
    if (/[?&]sent=1(&|$)/.test(location.search)){
      showContactDone();
      if (typeof window.gtag === 'function'){
        window.gtag('event', 'generate_lead', { method: 'form' });
      }
      if (history.replaceState){
        history.replaceState(null, '', location.pathname + '#contact');
      }
    }
  }


  // ===== Pipelines: one item moving through a system =====
  // The hero pipeline and the automation flow describe the same idea, so they
  // share one walker. Each loops only while its diagram is on screen — a
  // pulse running against an unscrolled section is wasted motion and wasted
  // battery. Hovering restarts the pass.
  function pulse(root, selector, stepMs, holdMs, restMs){
    if (!root || reduce) return function(){};
    var steps = Array.prototype.slice.call(root.querySelectorAll(selector));
    if (!steps.length) return function(){};
    var timers = [], loop = null, running = false;

    function clear(){
      timers.forEach(clearTimeout);
      timers = [];
      steps.forEach(function(el){ el.classList.remove('lit'); });
    }
    function pass(){
      clear();
      steps.forEach(function(el, i){
        timers.push(setTimeout(function(){ el.classList.add('lit'); }, i * stepMs));
        timers.push(setTimeout(function(){ el.classList.remove('lit'); }, i * stepMs + holdMs));
      });
    }
    function start(){
      if (running) return;
      running = true;
      pass();
      loop = setInterval(pass, steps.length * stepMs + holdMs + restMs);
    }
    function stop(){
      if (!running) return;
      running = false;
      clearInterval(loop);
      clear();
    }

    if ('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if (e.isIntersecting) start(); else stop(); });
      }, {threshold:.3}).observe(root);
    } else {
      start();
    }
    root.addEventListener('mouseenter', pass);
    return pass;
  }

  // ===== Hero: the signal on the system =====
  // Walks the four rows once after they have risen, rests on the first, and
  // follows the pointer after that. Static on the first row under reduced motion.
  var heroSys = document.querySelector('.hero-system');
  if (heroSys){
    var hsRows = Array.prototype.slice.call(heroSys.querySelectorAll('.hs-row'));
    var hsSig = heroSys.querySelector('.hs-signal');
    var hsHome = 0, hsTimers = [];
    function hsPut(i){
      var r = hsRows[i].getBoundingClientRect(), s = heroSys.getBoundingClientRect();
      var nameEl = hsRows[i].querySelector('.hs-name'), n = nameEl.getBoundingClientRect();
      hsSig.style.transform = 'translateY(' + Math.round(n.top + n.height / 2 - s.top - hsSig.offsetHeight / 2) + 'px)';
    }
    function hsWalk(){
      hsTimers.forEach(clearTimeout); hsTimers = [];
      hsPut(0); hsSig.classList.add('on');
      if (reduce) return;
      hsRows.forEach(function(_, i){ if (i) hsTimers.push(setTimeout(function(){ hsPut(i); }, 340 + i * 300)); });
      hsTimers.push(setTimeout(function(){ hsPut(0); }, 340 + hsRows.length * 300 + 260));
    }
    hsRows.forEach(function(row, i){
      row.addEventListener('mouseenter', function(){ hsTimers.forEach(clearTimeout); hsTimers = []; hsPut(i); });
      row.addEventListener('focus', function(){ hsTimers.forEach(clearTimeout); hsTimers = []; hsPut(i); });
      row.addEventListener('mouseleave', function(){ hsPut(hsHome); });
      row.addEventListener('blur', function(){ hsPut(hsHome); });
    });
    // After the last row has risen (1140ms delay + 520ms).
    setTimeout(hsWalk, reduce ? 0 : 1700);
    window.addEventListener('resize', function(){ hsPut(hsHome); }, {passive:true});
  }
  // Nodes and arrows share the walk, so the pulse travels the connectors too.
  pulse(document.querySelector('.flow-mock .flow-row'), '.flow-node,.fl-arrow', 260, 780, 2600);

  // ===== 02 · The climb =====
  // Tabs over a drawn staircase. Every rung's copy is static HTML, readable
  // without this script; this only draws the stair, moves the signal and
  // swaps the panels.
  var climb = document.querySelector('.climb');
  if (climb){
    var stair = climb.querySelector('.stair');
    var sig = climb.querySelector('.signal');
    var rungTabs = Array.prototype.slice.call(climb.querySelectorAll('[role="tab"]'));
    var rungPanels = rungTabs.map(function(t){ return document.getElementById(t.getAttribute('aria-controls')); });
    var panelWrap = climb.querySelector('.climb-panels');
    var current = 2;                 // the rung whose panel is showing
    var at = 1;                      // the rung the signal is standing on
    var run = 0;                     // bumped to abandon a climb when another rung is chosen
    var inflight = Promise.resolve();
    var ready = false;

    // Where the signal stands on a rung: over the tread, in line with the label.
    function spot(k){
      var t = rungTabs[k - 1], s = stair.getBoundingClientRect(), r = t.getBoundingClientRect();
      var pad = parseFloat(getComputedStyle(t).paddingLeft) || 0;
      return { x: Math.round(r.left - s.left + pad), y: Math.round(r.top - s.top - sig.offsetHeight - 6) };
    }
    function put(k){ var p = spot(k); sig.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; at = k; }
    function land(){ sig.classList.remove('landed'); void sig.offsetWidth; sig.classList.add('landed'); }
    function light(k){ var t = rungTabs[k - 1]; t.classList.add('is-lit'); setTimeout(function(){ t.classList.remove('is-lit'); }, 460); }

    // One rung at a time: up then across when climbing, across then down when
    // descending. Choosing 05 from 02 visits 03 and 04 on the way.
    function hop(to){
      var a = spot(at), b = spot(to), mid = to > at ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
      put(to);
      if (!sig.animate) return Promise.resolve();
      return sig.animate([
        { transform: 'translate(' + a.x + 'px,' + a.y + 'px)' },
        { transform: 'translate(' + mid.x + 'px,' + mid.y + 'px)', offset: .42 },
        { transform: 'translate(' + b.x + 'px,' + b.y + 'px)' }
      ], { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' }).finished.catch(function(){});
    }
    function climbTo(k){
      var id = ++run;
      if (reduce){ put(k); return; }
      inflight = inflight.then(function next(){
        if (id !== run) return;
        if (at === k){ land(); return; }
        var to = at + (k > at ? 1 : -1);
        return hop(to).then(function(){ if (id === run){ light(to); return next(); } });
      });
    }
    function select(k, byKey){
      if (k === current){ if (byKey) rungTabs[k - 1].focus(); return; }
      climb.style.setProperty('--dir', k > current ? 1 : -1);
      var leaving = rungPanels[current - 1];
      leaving.classList.add('is-leaving');
      setTimeout(function(){ leaving.classList.remove('is-leaving'); }, 340);
      rungTabs.forEach(function(t, i){
        var on = i === k - 1;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        rungPanels[i].classList.toggle('is-active', on);
        rungPanels[i].tabIndex = on ? 0 : -1;
      });
      current = k;
      if (byKey) rungTabs[k - 1].focus();
      if (ready) climbTo(k);
      // Stacked layouts put the panel under the stair; bring it up if it is out of sight.
      var pr = panelWrap.getBoundingClientRect();
      if (window.innerWidth < 1280 && pr.top > window.innerHeight * .8){
        panelWrap.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    }
    rungTabs.forEach(function(t, i){
      t.addEventListener('click', function(){ select(i + 1, false); });
      t.addEventListener('keydown', function(e){
        var k = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1, ArrowDown: current - 1, Home: 1, End: 6 }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        select(Math.max(1, Math.min(6, k)), true);
      });
    });

    // The one unprompted moment: draw the stair, then walk the signal from the
    // client's finished rung up to the rung we start on.
    function begin(){
      climb.classList.add('in');
      if (reduce){ put(current); sig.classList.add('on'); ready = true; return; }
      setTimeout(function(){
        put(1); sig.classList.add('on'); ready = true;
        setTimeout(function(){ climbTo(current); }, 380);
      }, 1250);
    }
    if ('IntersectionObserver' in window){
      var climbIo = new IntersectionObserver(function(entries){
        if (entries[0].isIntersecting){ climbIo.disconnect(); begin(); }
      }, { threshold: .35 });
      climbIo.observe(climb);
    } else {
      begin();
    }
    window.addEventListener('resize', function(){ if (ready) put(at); });
  }

  // ===== 06 · The working page =====
  // The page builds one job at a time, the legend ticks each off, then an
  // enquiry runs down the wire to the phone. Pointing at a job lights its
  // block; pointing at job 4 sends the enquiry again.
  var webx = document.querySelector('.webx');
  if (webx){
    var wireEl = webx.querySelector('.wire');
    var parts = ['p0','p1','p2','p3','p4','p5','p6','p7'];
    var webTimers = [];
    var webDone = false;
    function measureWire(){ webx.style.setProperty('--run', Math.max(0, wireEl.getBoundingClientRect().width - 9) + 'px'); }
    function at(ms, fn){ webTimers.push(setTimeout(fn, ms)); }
    function sendEnquiry(delay){
      webx.classList.remove('p5','p6','p7');
      void webx.offsetWidth;
      measureWire();
      var first = !webx.classList.contains('wired');
      at(delay, function(){ webx.classList.add('p5', 'wired'); });
      at(delay + 180, function(){ webx.classList.remove('p5'); });
      at(delay + (first ? 460 : 220), function(){ webx.classList.add('p6'); });
      at(delay + (first ? 1080 : 840), function(){ webx.classList.add('p7'); webDone = true; });
    }
    function build(){
      if (reduce){ parts.forEach(function(p){ webx.classList.add(p); }); webx.classList.remove('p5'); webx.classList.add('wired'); webDone = true; return; }
      webx.classList.add('js-armed');
      void webx.offsetWidth;
      at(60,   function(){ webx.classList.add('p0'); });
      at(700,  function(){ webx.classList.add('p1'); });
      at(1250, function(){ webx.classList.add('p2'); });
      at(1800, function(){ webx.classList.add('p3'); });
      at(2350, function(){ webx.classList.add('p4'); });
      sendEnquiry(2950);
    }
    // Arm before first paint of the section so nothing flashes finished, then build on view.
    if (!reduce && 'IntersectionObserver' in window){
      webx.classList.add('js-armed');
      var webIo = new IntersectionObserver(function(entries){
        if (entries[0].isIntersecting){ webIo.disconnect(); build(); }
      }, { threshold: .3 });
      webIo.observe(webx);
    } else {
      build();
    }

    function focusJob(k){
      if (k) webx.setAttribute('data-focus', k); else webx.removeAttribute('data-focus');
    }
    Array.prototype.forEach.call(webx.querySelectorAll('[data-job]'), function(li){
      var k = li.getAttribute('data-job');
      li.addEventListener('mouseenter', function(){
        focusJob(k);
        if (k === '4' && webDone && !reduce) sendEnquiry(80);
      });
      li.addEventListener('mouseleave', function(){ focusJob(null); });
      // Touch: a tap pins the highlight; a second tap clears it.
      li.addEventListener('click', function(){ focusJob(webx.getAttribute('data-focus') === k ? null : k); });
    });
    Array.prototype.forEach.call(webx.querySelectorAll('.wf-part'), function(part){
      part.addEventListener('mouseenter', function(){ focusJob(part.getAttribute('data-part')); });
      part.addEventListener('mouseleave', function(){ focusJob(null); });
    });
    window.addEventListener('resize', measureWire);
  }

  // ===== Nav scroll-spy =====
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
  var spyTargets = navAnchors
    .map(function(a){ return { link:a, el:document.querySelector(a.getAttribute('href')) }; })
    .filter(function(t){ return t.el; });
  // Offsets are cached on load and resize and compared against scrollY, so the
  // scroll loop stays free of layout reads. A detection band tuned in
  // percentages was fragile: a section centred at 50% of the viewport fell
  // outside it, leaving a stale link marked.
  var spyOffsets = [];
  function measureSpy(){
    spyOffsets = spyTargets.map(function(t){
      return { link: t.link, top: t.el.getBoundingClientRect().top + window.scrollY };
    });
  }
  var spyCurrent = null;
  function updateSpy(){
    if (!spyOffsets || !spyOffsets.length) return;
    var line = window.scrollY + window.innerHeight * 0.32;
    var found = null;
    for (var i = 0; i < spyOffsets.length; i++){
      if (spyOffsets[i].top <= line) found = spyOffsets[i];
    }
    var link = found ? found.link : null;
    if (link === spyCurrent) return;
    navAnchors.forEach(function(a){ a.classList.remove('is-current'); });
    if (link) link.classList.add('is-current');
    spyCurrent = link;
  }
  measureSpy();
  updateSpy();
  // Both caches are offsets against the document, so both go stale for the
  // same reasons: webfonts settling on load, and any reflow on resize.
  window.addEventListener('load', function(){ measureSpy(); measureProcess(); measureSignal(); updateProcess(); updateSignal(); });
  window.addEventListener('resize', function(){ measureSpy(); measureProcess(); measureSignal(); }, {passive:true});

})();
