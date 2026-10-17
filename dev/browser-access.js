// Controls for the isolated settings fixture; never loaded by the extension.
document.getElementById('grant').addEventListener('click', () => chrome.storage.local.set({
  maxEntitlement: true, entitlement: { tier: 'max', status: 'active', entitlements: ['velocity_filter'] }
}));
document.getElementById('revoke').addEventListener('click', () => chrome.storage.local.set({
  maxEntitlement: false, entitlement: { tier: 'free', status: 'inactive', entitlements: [] }
}));
