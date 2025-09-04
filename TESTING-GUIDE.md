# 🧪 FAF Chrome Extension Testing Guide

## 🚀 Installation

1. **Open Chrome Extensions Page**
   ```
   chrome://extensions/
   ```

2. **Clean Install**
   - Remove any existing FAF extensions first
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select: `/Users/wolfejam/faf-production/dist/`

3. **Verify Installation**
   - Extension should show "FAF" with orange icon
   - No error messages on the extension card
   - Click "Details" → "Inspect views: service worker" to check for errors

## 🎯 Testing Procedure

### Test 1: GitHub Repository (Monaco Editor)
1. Go to: `https://github.com/microsoft/monaco-editor`
2. Wait for page to fully load
3. Click the FAF extension icon in toolbar
4. Click "Extract Context" button
5. **Expected Score: 90-100%** (was 9% before fix)

### Test 2: React Repository  
1. Go to: `https://github.com/facebook/react`
2. Wait for page to fully load
3. Click the FAF extension icon
4. Click "Extract Context" button
5. **Expected Score: 85-95%** (was 45% before)

### Test 3: Any Code Playground
1. Go to: `https://codesandbox.io` or `https://stackblitz.com`
2. Open any project
3. Click FAF extension
4. **Expected Score: 85-90%**

## 🔧 Troubleshooting

### Service Worker Issues
If you see service worker errors:
1. Go to `chrome://extensions/`
2. Find FAF extension
3. Click "Details"
4. Click "Inspect views: service worker"
5. Check Console for errors
6. Try clicking "Reload" on the extension

### "Could not establish connection" Error
This is normal on first load:
1. Refresh the target page (Cmd+R)
2. Try extracting again
3. The error should show: "Content script not ready. Please refresh the page and try again."

### Low Scores (9% issue)
If still getting low scores:
1. Check service worker console for errors
2. Verify the page has fully loaded
3. Try on a different GitHub repo

## 📊 What Changed

The updates from Gemini/recent changes:
- `browser-faf-engine.ts` - Now uses real `ScoreCalculator`
- `scorer.ts` - Implements slot-based scoring from faf-engine Mk-1
- `chrome.ts` - Improved error handling for messaging

## ✅ Success Criteria

- Monaco Editor: **90-100%** ✅
- React: **85-95%** ✅  
- No critical errors in console ✅
- Extraction completes successfully ✅

## 🚨 Known Issues

1. **First load**: Content script may not be ready - refresh page
2. **Dev mode quirks**: Service worker may go inactive - reload extension
3. **Keyboard shortcut**: Ctrl+Shift+F not working yet (todo)

---

**Quality Standard**: 🏎️⚡️Wolfejam - Real scoring, no fakes!