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
