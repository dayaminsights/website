/* Homepage hero: the agent console. Hidden until the next commit wires it up. */
(function(){
  var c = document.getElementById('heroConsole');
  if (c) (c.closest('.hero-stage') || c).hidden = true;
})();
