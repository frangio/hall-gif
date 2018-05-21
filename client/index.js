const screenfull = require('screenfull');
const NoSleep = require('nosleep.js');

const noSleep = new NoSleep();

function goFullscreen() {
  if (screenfull.enabled) {
    screenfull.request();
    noSleep.enable();
  }
}

screenfull.on('change', function() {
  if (!screenfull.isFullscreen) {
    noSleep.disable();
  }
});

global.goFullscreen = goFullscreen;

const stream = new EventSource('/stream');

stream.addEventListener('message', function(e) {
  const data = JSON.parse(e.data);
  const img = document.querySelector('#content');
  img.src = data.src;
});
