import screenfull from 'screenfull';
import NoSleep from 'nosleep.js';

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

async function refresh() {
  const res = await fetch("/image/poll");

  if (res.status === 205) {
    window.location.reload(true);
  }
}

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

async function main() {
  while (true) {
    try {
      await refresh();
    } catch (e) {
      console.error(e);
      await sleep(1000);
    }
  }
}

main().catch(console.error);
