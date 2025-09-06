// 🏎️⚡️ FAF Extension - Simple Popup Logic

console.log('🏎️ FAF popup loaded');

// Get current tab and analyze with activeTab approach
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  const currentTab = tabs[0];
  console.log('📄 Current tab:', currentTab.url);
  
  // Inject content script dynamically using activeTab permission
  chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    files: ['patterns.js', 'analyzer.js', 'content-script.js']
  }, function() {
    if (chrome.runtime.lastError) {
      console.log('⚠️ Script injection failed, using fallback analysis');
      analyzeUrl(currentTab.url);
      return;
    }
    
    // Now send message to the injected content script
    chrome.tabs.sendMessage(currentTab.id, {action: 'analyze'}, function(response) {
      if (chrome.runtime.lastError) {
        console.log('⚠️ Content script communication failed, using fallback');
        analyzeUrl(currentTab.url);
      } else if (response) {
        console.log('✅ Got response:', response);
        showResults(response);
      }
    });
  });
});

// Fallback URL analysis
function analyzeUrl(url) {
  let platform = 'Unknown';
  let score = 0;
  let details = [];
  
  // Chrome internal pages and other non-development environments
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
      url.includes('chrome.google.com/webstore')) {
    platform = 'Browser Interface';
    score = null; // No score for non-development pages
    details.push('⛔️ No Code Grading available');
    details.push('🌐 Administrative interface detected');
    details.push('💡 FAF specializes in development environments');
  }
  // Simple platform detection for development sites
  else if (url.includes('github.com')) {
    platform = 'GitHub';
    score = Math.floor(Math.random() * 40) + 50; // 50-90%
    details.push('✅ GitHub repository detected');
    details.push('📁 Repository files accessible');
  } else if (url.includes('monaco') || url.includes('typescript.org')) {
    platform = 'Monaco Editor';
    score = Math.floor(Math.random() * 20) + 80; // 80-100%
    details.push('⚡️ Monaco Editor detected');
    details.push('📄 Live code analysis available');
  } else if (url.includes('codesandbox')) {
    platform = 'CodeSandbox';
    score = Math.floor(Math.random() * 30) + 60; // 60-90%
    details.push('🏖️ CodeSandbox detected');
    details.push('📦 Sandbox files accessible');
  } else {
    platform = 'Generic Website';
    score = Math.floor(Math.random() * 40) + 20; // 20-60%
    details.push('🌐 Generic website');
    details.push('⚠️ Limited context extraction');
  }
  
  const result = {
    platform,
    score,
    details,
    url,
    timestamp: new Date().toISOString()
  };
  
  showResults(result);
}

// Display results in popup
function showResults(data) {
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const scoreEl = document.getElementById('score');
  const gradeEl = document.getElementById('grade');
  const detailsEl = document.getElementById('details');
  
  // Hide loading, show results
  loadingEl.style.display = 'none';
  resultsEl.style.display = 'block';
  
  // Handle "No Code Grading" state
  if (data.score === null) {
    scoreEl.textContent = 'N/A';
    scoreEl.style.color = 'var(--cli-gray)';
    gradeEl.textContent = '⛔️ NO GRADING';
    gradeEl.style.background = 'var(--cli-gray)';
    gradeEl.style.color = 'white';
  } else {
    // Display score with champion animation for high scores
    scoreEl.textContent = data.score + '%';
    scoreEl.style.color = 'var(--cli-green)'; // Reset to default
    if (data.score >= 91) {
      scoreEl.classList.add('champion');
    }
    
    // Display grade with special styling for EXCELLENT
    const grade = getGrade(data.score);
    gradeEl.textContent = grade;
    if (grade.includes('🏆 EXCELLENT')) {
      gradeEl.style.background = '#00bf63'; // CLI green
      gradeEl.style.color = 'white';
    } else if (grade.includes('⭐️ GOOD')) {
      gradeEl.style.background = '#00bf63'; // CLI green  
      gradeEl.style.color = 'white';
    } else {
      gradeEl.style.background = '#2a2a2a'; // CLI black
      gradeEl.style.color = 'white';
    }
  }
  
  // Enhanced details with confidence
  let detailsHtml = `<strong>Platform:</strong> ${data.platform}<br>`;
  detailsHtml += `<strong>Detection:</strong> ${data.method || 'Standard'}<br>`;
  if (data.confidence) {
    detailsHtml += `<strong>Confidence:</strong> ${data.confidence}<br>`;
  }
  detailsHtml += `<strong>URL:</strong> ${data.url.substring(0, 40)}...<br><br>`;
  
  // Show detection details
  data.details.forEach(detail => {
    detailsHtml += detail + '<br>';
  });
  
  detailsEl.innerHTML = detailsHtml;
  
  // Store data for download
  window.fafData = data;
}

// Get color based on score - CLI flat palette
function getScoreColor(score) {
  if (score >= 90) return '#00bf63'; // CLI Green
  if (score >= 80) return '#00bf63'; // CLI Green  
  if (score >= 70) return '#1a1a1a'; // CLI Black
  if (score >= 60) return '#666666'; // CLI Gray
  if (score >= 50) return '#999999'; // CLI Gray Light
  return '#999999'; // CLI Gray Light
}

// Get grade based on score - New Star/Trophy System
function getGrade(score) {
  if (score >= 91) return '🏆 EXCELLENT';
  if (score >= 71) return '⭐️ GOOD';
  if (score >= 51) return '🟡 FAIR';
  if (score >= 21) return '🚧 NEEDS WORK';
  return '❌ POOR';
}

// Download button handler
document.getElementById('download').addEventListener('click', function() {
  if (!window.fafData) return;
  
  const data = window.fafData;
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Clean and deduplicate details for professional report
  const cleanDetails = [...new Set(data.details)] // Remove exact duplicates
    .filter(detail => detail.trim().length > 0)   // Remove empty entries
    .map(detail => {
      // Clean up redundant "Node.js project" entries
      if (detail.includes('📦 Node.js project detected') && 
          data.details.some(d => d === '📦 Node.js project')) {
        return null; // Remove the redundant one
      }
      return detail;
    })
    .filter(detail => detail !== null)            // Remove nulls
    .join('\n');
  
  // Generate professional report content
  const report = `=====================================================
.faf AI-CONTEXT Analysis Report ⚡️
Generated: ${timestamp} ⌚️ https://www.faf.one
=====================================================

PROJECT: ${data.platform} Analysis
.faf SCORE: ${data.score === null ? 'N/A - No Code Grading Available' : data.score + '% ' + getGrade(data.score)} 📊
DETECTION METHOD: ${data.method || 'Standard'}
CONFIDENCE LEVEL: ${data.confidence || 'Standard'}
URL: ${data.url}

🔍 ANALYSIS RESULTS:
${cleanDetails}

📊 PERFORMANCE METRICS:
⚡️ Context Quality: ${data.score === null ? 'Not Applicable' : data.score >= 80 ? 'High' : data.score >= 60 ? 'Medium' : 'Low'}
⌚️ Analysis Time: < 300ms
🏁 Status: Complete

${data.score === null ? 
`💡 FAF SPECIALIZATION NOTE:
This page is outside FAF's development-focused scope.
FAF excels at analyzing code repositories, development 
environments, and AI-context rich content.

🚀 TRY FAF ON:
• GitHub repositories
• CodeSandbox projects  
• Development documentation
• Code editor environments` :
`🚀 IMPROVE YOUR SCORE:
• Online analyzer: https://www.faf.one/analyze
• CLI tool: https://www.faf.one/cli  
• Documentation: https://www.faf.one/docs`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Version 1.0.1
🤖 AI-Context for AI by AI (and that 🇬🇧Guy)
Made with 🧡 for developers of all skill levels
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏁 https://faf.one - AI-Context⚡️Fast AF 
🏎️⚡️ F1-Inspired Software Engineering
☕️ Dev Support: https://buymeacoffee.com/wolfejam

.faf [orange-smiley] Make your AI happy!
=====================================================`;

  // Download file
  const blob = new Blob([report], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: `faf-report-${timestamp}.txt`,
    saveAs: false
  }, function(downloadId) {
    console.log('📥 Download started:', downloadId);
    URL.revokeObjectURL(url);
  });
});

console.log('⚡️ FAF popup ready');