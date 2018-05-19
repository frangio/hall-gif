async function main() {
  const res = await fetch("/image/poll");

  if (res.status === 205) {
    window.location.reload(true);
  } else {
    return main();
  }
}

main().catch(console.error);
