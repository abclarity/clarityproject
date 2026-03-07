// scripts/loading.js
// Loading State Management

(function(window) {
  'use strict';

  let loadingOverlay = null;
  let loadingCount = 0;

  function initLoadingOverlay() {
    if (loadingOverlay) return;

    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loadingOverlay';
    loadingOverlay.className = 'loading-overlay hidden';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p class="loading-text">Wird geladen...</p>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  }

  function showLoading(text = 'Wird geladen...') {
    initLoadingOverlay();
    loadingCount++;

    const loadingText = loadingOverlay.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = text;
    }

    loadingOverlay.classList.remove('hidden');
    setTimeout(() => {
      loadingOverlay.classList.add('loading-show');
    }, 10);
  }

  function hideLoading() {
    if (!loadingOverlay) return;

    loadingCount = Math.max(0, loadingCount - 1);

    if (loadingCount === 0) {
      loadingOverlay.classList.remove('loading-show');
      setTimeout(() => {
        loadingOverlay.classList.add('hidden');
      }, 300);
    }
  }

  function forceHideLoading() {
    if (!loadingOverlay) return;

    loadingCount = 0;
    loadingOverlay.classList.remove('loading-show');
    loadingOverlay.classList.add('hidden');
  }

  window.Loading = {
    show: showLoading,
    hide: hideLoading,
    forceHide: forceHideLoading
  };

  document.addEventListener('DOMContentLoaded', initLoadingOverlay);

})(window);
