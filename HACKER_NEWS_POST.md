# Hacker News Post - Show HN

## Title
Show HN: Chrome extension to grab any codebase as .txt (GitHub, Monaco, StackBlitz)

## Post Body

I built this Chrome extension to solve my own problem: I was constantly testing things in StackBlitz, Monaco playgrounds, and GitHub repos, then needing to paste that code into Claude or Cursor to ask questions about it. Manually copying files one by one was annoying.

The extension extracts the entire codebase from whatever environment you're in (GitHub, Monaco editor, StackBlitz, GitLab, CodeSandbox, Replit, etc.) and copies it to your clipboard as clean .txt. One click, done.

Chrome Web Store: https://chromewebstore.google.com/detail/lnecebepmpjpilldfmndnaofbfjkjlkm

GitHub (MIT): https://github.com/Wolfe-Jam/faf-chrome-extension

Built with Svelte 5 + TypeScript. Google approved it. Currently has 9 downloads (honest number—just launched). But it genuinely works well, which is why I use it daily.

The .txt format is intentionally simple—human-readable, AI-compatible, and acts as a pre-cursor to our .faf format (structured AI context). If you work with AI coding assistants and ever think "I wish I could just grab all this code at once," this is that tool.

Happy to answer questions about the implementation, platform detection logic, or anything else.

---

## Alternative Title Options
- Show HN: One-click context extraction for any dev environment (Chrome extension)
- Show HN: Chrome extension to grab GitHub/Monaco/StackBlitz code as .txt for AI tools
- Show HN: Context extractor for developers using AI coding assistants

## Timing
- Best: Weekday morning (9-11am PT) for maximum engagement
- Avoid: Friday afternoon, weekends (lower traffic)
- Be ready to respond to comments within first 2 hours

## HN Culture Notes
- Be technical and honest
- Acknowledge limitations
- Respond to criticism constructively
- Share implementation details when asked
- Don't over-promote or use marketing language
- The "9 downloads" honesty is actually a strength on HN

## Expected Questions & Answers

**Q: How does it detect different platforms?**
A: Content script runs on every page, checks for platform-specific selectors (GitHub's .js-navigation-container, Monaco's .monaco-editor, StackBlitz's WebContainer API, etc.). Falls back to generic code block detection if no specific platform is found.

**Q: Privacy concerns?**
A: Zero network requests, everything runs locally. No data collection. Open source so you can audit the code. That's why Google approved it.

**Q: Why .txt instead of JSON?**
A: Readability. When you paste into Claude, you want the AI to understand it immediately. .txt with clear file separators works better than nested JSON. Plus it's a pre-cursor to .faf format which any of our tools can parse.

**Q: Performance?**
A: Averages <300ms for most repos. Svelte 5 keeps the popup fast, content script is lazy-loaded per platform.

**Q: What about large repos?**
A: We extract up to reasonable limits (configurable). For huge repos, we prioritize entry points and recently modified files. Clipboard has limits anyway.

**Q: Other browsers?**
A: Just Chrome for now. Firefox version planned, need to test manifest differences.

---

## Success Metrics (Realistic)
- 50+ upvotes = success
- 100+ upvotes = great launch
- Front page for 4+ hours = excellent
- Engagement in comments = most important

## Post-Launch Actions
1. Monitor comments first 2 hours (critical)
2. Answer questions quickly and technically
3. Update README if good suggestions come up
4. Track Chrome Web Store downloads spike
5. Note any bugs reported for quick fix

---

**Status: Ready to post**
**Prepared: 2025-10-23**
