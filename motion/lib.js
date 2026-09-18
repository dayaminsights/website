// Shared helpers for the hero motion sources in this folder.
//
// Every scene is a pure function of time: window.render(t) paints the frame at
// t seconds and reads nothing else — no CSS transitions, no timers. That is
// what lets render.js step through it one exact frame at a time instead of
// screen-recording it. Opened directly in a browser, a scene plays itself live
// on a loop so it can be previewed without rendering.
(function(){
  var clamp = function(x, a, b){ return Math.min(b, Math.max(a, x)); };
  var M = {
    clamp: clamp,
    // Progress of t across [a, b], clamped to 0..1.
    p: function(t, a, b){ return clamp((t - a) / (b - a), 0, 1); },
    out: function(x){ return 1 - Math.pow(1 - x, 3); },
    inOut: function(x){ return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    lerp: function(a, b, x){ return a + (b - a) * x; },
    $: function(id){ return document.getElementById(id); },
    set: function(el, attrs){ for (var k in attrs) el.setAttribute(k, attrs[k]); },
    boot: function(render, duration){
      window.render = render;
      window.DURATION = duration;
      var go = function(){
        window.READY = true;
        if (window.__RENDER__) { render(0); return; }
        var t0 = performance.now();
        var loop = function(now){ render(((now - t0) / 1000) % duration); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      };
      Promise.all([
        document.fonts.load('400 16px Inter'),
        document.fonts.load('500 16px Inter'),
        document.fonts.load('600 16px Inter'),
        document.fonts.ready
      ]).then(go, go);
    }
  };
  window.M = M;
})();
