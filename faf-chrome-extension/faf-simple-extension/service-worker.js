// 🏎️⚡️ FAF Extension - Service Worker

console.log('🏎️ FAF service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('⚡️ FAF extension installed');
  
  // Set up keyboard shortcut
  chrome.action.setBadgeText({
    text: 'FAF'
  });
  
  chrome.action.setBadgeBackgroundColor({
    color: '#ff6b35'  // FAF orange
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Service worker received message:', request);
  
  if (request.action === 'analyze_tab') {
    // Forward message to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'analyze'}, (response) => {
          sendResponse(response);
        });
      }
    });
    return true; // Keep message channel open
  }
  
  if (request.action === 'get_tab_info') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title
        });
      }
    });
    return true;
  }
});

// Handle extension icon click (opens popup)
chrome.action.onClicked.addListener((tab) => {
  console.log('🖱️ Extension icon clicked');
  // Popup will open automatically due to manifest configuration
});

console.log('⚡️ FAF service worker ready');