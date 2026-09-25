importScripts('config.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(XA_CONFIG.DEFAULTS).then((stored) => {
    chrome.storage.local.set(XA_CONFIG.mergeSettings(stored));
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'get-settings') return false;
  chrome.storage.local.get(XA_CONFIG.DEFAULTS).then((stored) => {
    sendResponse(XA_CONFIG.mergeSettings(stored));
  });
  return true;
});
