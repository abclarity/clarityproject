// scripts/toast.js
// Toast Notification System

(function(window) {
  'use strict';

  const TOAST_DURATION = 3500;
  const TOAST_MAX_STACK = 5;
  let toastContainer = null;
  let toastQueue = [];

  function initToastContainer() {
    if (toastContainer) return;

    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  function showToast(message, type = 'info') {
    initToastContainer();

    if (toastQueue.length >= TOAST_MAX_STACK) {
      const oldestToast = toastQueue.shift();
      if (oldestToast && oldestToast.parentElement) {
        oldestToast.remove();
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = getIconForType(type);
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;

    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(messageSpan);

    toastContainer.appendChild(toast);
    toastQueue.push(toast);

    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
        const index = toastQueue.indexOf(toast);
        if (index > -1) {
          toastQueue.splice(index, 1);
        }
      }, 300);
    }, TOAST_DURATION);

    toast.addEventListener('click', () => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
        const index = toastQueue.indexOf(toast);
        if (index > -1) {
          toastQueue.splice(index, 1);
        }
      }, 300);
    });
  }

  function getIconForType(type) {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  }

  window.Toast = {
    success: (message) => showToast(message, 'success'),
    error: (message) => showToast(message, 'error'),
    warning: (message) => showToast(message, 'warning'),
    info: (message) => showToast(message, 'info')
  };

  document.addEventListener('DOMContentLoaded', initToastContainer);

})(window);
