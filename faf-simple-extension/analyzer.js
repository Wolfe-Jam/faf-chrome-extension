// 🏎️⚡️ FAF Extension - Advanced Platform Detection Engine

class FAFAnalyzer {
  constructor(patterns = window.FAF_PATTERNS) {
    this.patterns = patterns;
    this.detectedPlatforms = new Set();
    this.currentUrl = window.location.href;
  }

  // Main analysis function
  analyze() {
    console.log('🔍 Starting comprehensive platform analysis...');
    
    const results = [];
    
    // Test each platform pattern
    for (const [platformName, pattern] of Object.entries(this.patterns)) {
      const detection = this.testPattern(platformName, pattern);
      if (detection.detected) {
        results.push(detection);
        this.detectedPlatforms.add(platformName);
      }
    }
    
    // Sort by confidence score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Return the best match or generic
    return results.length > 0 ? results[0] : this.getGenericResult();
  }

  // Test individual platform pattern
  testPattern(platformName, pattern) {
    let score = 0;
    let detected = false;
    const details = [];
    
    // URL pattern matching
    if (pattern.url && this.testUrlPattern(pattern.url)) {
      detected = true;
      score += pattern.score || 50;
      details.push(`🌐 URL pattern matched: ${platformName}`);
    }
    
    // DOM element detection
    if (pattern.dom) {
      const domResults = this.testDomPattern(pattern.dom);
      if (domResults.detected) {
        detected = true;
        score += domResults.score;
        details.push(...domResults.details);
      }
    }
    
    // JavaScript detection
    if (pattern.js) {
      const jsResults = this.testJavaScriptPattern(pattern.js);
      if (jsResults.detected) {
        detected = true;
        score += jsResults.score;
        details.push(...jsResults.details);
      }
    }
    
    // HTML content detection
    if (pattern.html) {
      const htmlResults = this.testHtmlPattern(pattern.html);
      if (htmlResults.detected) {
        detected = true;
        score += htmlResults.score;
        details.push(...htmlResults.details);
      }
    }
    
    // Bonus features detection
    if (detected && pattern.bonuses) {
      const bonusResults = this.testBonusFeatures(pattern.bonuses);
      score += bonusResults.score;
      details.push(...bonusResults.details);
    }
    
    return {
      platform: platformName,
      detected,
      score: Math.min(score, 100), // Cap at 100%
      details,
      confidence: this.getConfidence(score)
    };
  }

  // Test URL patterns
  testUrlPattern(urlPattern) {
    if (!urlPattern) return false;
    const regex = new RegExp(urlPattern, 'i');
    return regex.test(this.currentUrl);
  }

  // Test DOM patterns
  testDomPattern(domPatterns) {
    let detected = false;
    let score = 0;
    const details = [];
    
    for (const [selector, requirements] of Object.entries(domPatterns)) {
      try {
        const elements = document.querySelectorAll(selector);
        
        if (requirements.exists !== undefined && elements.length > 0) {
          detected = true;
          score += 15;
          details.push(`✅ DOM element found: ${selector}`);
        }
        
        if (requirements.attributes) {
          for (const element of elements) {
            for (const [attr, expectedValue] of Object.entries(requirements.attributes)) {
              const actualValue = element.getAttribute(attr);
              if (actualValue && (expectedValue === "" || actualValue.includes(expectedValue))) {
                score += 5;
                details.push(`🔍 Attribute matched: ${attr}`);
              }
            }
          }
        }
      } catch (error) {
        // Invalid selector, skip
        continue;
      }
    }
    
    return { detected, score, details };
  }

  // Test JavaScript patterns
  testJavaScriptPattern(jsPatterns) {
    let detected = false;
    let score = 0;
    const details = [];
    
    for (const pattern of jsPatterns) {
      try {
        // Check window object for pattern
        if (this.searchInObject(window, pattern)) {
          detected = true;
          score += 10;
          details.push(`⚡️ JavaScript detected: ${pattern}`);
        }
        
        // Check document for pattern - CONSOLIDATED VERSION
        const scripts = document.querySelectorAll('script');
        let matchingScripts = 0;
        
        for (const script of scripts) {
          if (script.src && script.src.toLowerCase().includes(pattern.toLowerCase())) {
            matchingScripts++;
          }
        }
        
        if (matchingScripts > 0) {
          detected = true;
          score += Math.min(matchingScripts * 2, 20); // Cap bonus at 20 points
          details.push(`📜 Script sources: ${pattern} (${matchingScripts} found)`);
        }
      } catch (error) {
        // Skip on error
        continue;
      }
    }
    
    return { detected, score, details };
  }

  // Test HTML content patterns
  testHtmlPattern(htmlPatterns) {
    let detected = false;
    let score = 0;
    const details = [];
    
    const html = document.documentElement.outerHTML;
    let matchedPatterns = [];
    
    for (const pattern of htmlPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(html)) {
          detected = true;
          score += 8;
          matchedPatterns.push(pattern);
        }
      } catch (error) {
        // Invalid regex, skip
        continue;
      }
    }
    
    // Consolidate multiple pattern matches
    if (matchedPatterns.length > 0) {
      if (matchedPatterns.length === 1) {
        details.push(`📄 HTML pattern: ${matchedPatterns[0]}`);
      } else {
        details.push(`📄 HTML patterns: ${matchedPatterns.length} matches found`);
      }
    }
    
    return { detected, score, details };
  }

  // Test bonus features
  testBonusFeatures(bonusPatterns) {
    let score = 0;
    const details = [];
    
    for (const [selector, bonus] of Object.entries(bonusPatterns)) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          score += bonus.score || 5;
          details.push(bonus.message || `🎯 Bonus feature: ${selector}`);
        }
      } catch (error) {
        // Invalid selector, skip
        continue;
      }
    }
    
    // Special detection for Node.js projects (only if not already detected)
    if (document.querySelector('a[title="package.json"]')) {
      const alreadyDetected = details.some(detail => 
        detail.includes('Node.js') || detail.includes('📦')
      );
      if (!alreadyDetected) {
        score += 10;
        details.push('📦 Node.js project detected');
      }
    }
    
    return { score, details };
  }

  // Search for pattern in object recursively
  searchInObject(obj, pattern, depth = 0) {
    if (depth > 3) return false; // Prevent infinite recursion
    
    try {
      for (const key in obj) {
        if (key.toLowerCase().includes(pattern.toLowerCase())) {
          return true;
        }
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (this.searchInObject(obj[key], pattern, depth + 1)) {
            return true;
          }
        }
      }
    } catch (error) {
      // Skip on access errors
    }
    
    return false;
  }

  // Get confidence level
  getConfidence(score) {
    if (score >= 90) return 'Very High';
    if (score >= 75) return 'High';
    if (score >= 60) return 'Medium';
    if (score >= 40) return 'Low';
    return 'Very Low';
  }

  // Get generic result for unknown sites
  getGenericResult() {
    const codeBlocks = document.querySelectorAll('pre code, .highlight, .codehilite, .language-');
    const hasCode = codeBlocks.length > 0;
    
    return {
      platform: hasCode ? 'Documentation Site' : 'Generic Website',
      detected: true,
      score: hasCode ? 35 : 20,
      details: [
        hasCode ? `💻 ${codeBlocks.length} code blocks found` : '🌐 Generic web content',
        '⚠️ Limited context extraction capability'
      ],
      confidence: 'Low'
    };
  }

  // Get all detected platforms
  getDetectedPlatforms() {
    return Array.from(this.detectedPlatforms);
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FAFAnalyzer;
} else if (typeof window !== 'undefined') {
  window.FAFAnalyzer = FAFAnalyzer;
}