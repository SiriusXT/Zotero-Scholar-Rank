var $__zsr;

function log(msg) {
  Zotero.debug('ZSR:' + msg);
}

function install() {
  log('Installed ZSR 4.0.0');
}

async function startup({ id, version, rootURI }) {
  log('Starting ZSR 4.0.0');

  Services.scriptloader.loadSubScript(`${rootURI}chrome/content/zsr.js`);
  $__zsr.app.init({ id, version, rootURI });
  $__zsr.app.addToAllWindows();
  await $__zsr.app.main();
}

function onMainWindowLoad({ window }) {
  $__zsr.app.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  $__zsr.app.removeFromWindow(window);
}

function shutdown() {
  $__zsr.app.removeFromAllWindows();
}

function uninstall() {
  $__zsr.app.removeFromAllWindows();
}
