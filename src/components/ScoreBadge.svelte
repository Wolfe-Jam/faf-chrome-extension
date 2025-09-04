<script lang="ts">
  export let score: number;
  export let platform: string;
  export let fileCount: number;

  // Get score color based on value
  function getScoreColor(score: number): string {
    if (score >= 90) return '#10b981'; // green-500
    if (score >= 70) return '#3b82f6'; // blue-500
    if (score >= 50) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  }
</script>

<div class="score-section">
  <div class="score-badge" style="background: {getScoreColor(score)}">
    {score}%
  </div>
  <div class="score-details">
    <div class="platform">
      <span class="label">Platform:</span>
      <span class="value">{platform}</span>
    </div>
    <div class="files">
      <span class="label">Files:</span>
      <span class="value">{fileCount}</span>
    </div>
  </div>
</div>

<style>
  .score-section {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .score-badge {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
    font-weight: bold;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .score-details {
    flex: 1;
  }

  .platform, .files {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .label {
    color: #6b7280;
  }

  .value {
    font-weight: 500;
  }
</style>