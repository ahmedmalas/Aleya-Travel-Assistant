/* Temporary PR #29 preview build identity — remove after personal verification. */
(function installPreviewBuildIdentity() {
  var identity = {
    environment: 'PR #29 Preview',
    gitSha: '6882faf',
    engine: 'runConversationTurn',
    chunk: 'travel-conversation-BoezO4jf.js',
    entryPoint: 'runConversationTurn',
    consultantModulePresent: false,
  };

  window.__ALEYA_BUILD_IDENTITY__ = identity;
  window.__ALEYA_ENGINE_ENTRY__ = 'runConversationTurn';

  function renderBanner() {
    if (document.getElementById('preview-build-identity')) return;
    var aside = document.createElement('aside');
    aside.id = 'preview-build-identity';
    aside.setAttribute('data-testid', 'preview-build-identity');
    aside.setAttribute('aria-label', 'Preview build identity');
    aside.style.cssText = [
      'position:sticky',
      'top:0',
      'z-index:99999',
      'margin:0',
      'padding:10px 14px',
      'background:#422006',
      'color:#fef3c7',
      'border-bottom:1px solid #f59e0b',
      'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
      'white-space:pre-line',
    ].join(';');
    aside.textContent =
      'Environment: ' + identity.environment + '\n' +
      'Git SHA: ' + identity.gitSha + '\n' +
      'Engine: ' + identity.engine + '\n' +
      'Chunk: ' + identity.chunk;
    document.body.insertBefore(aside, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBanner);
  } else {
    renderBanner();
  }
})();
