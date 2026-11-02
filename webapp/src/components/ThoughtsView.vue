<script setup lang="ts">
defineProps<{
  content: string;
}>();
</script>

<template>
  <section class="nav-view-panel active">
    <div class="editor-card history-card">
      <div class="history-header">
        <span class="memory-label">Continuous Timeline History:</span>
      </div>
      <div class="memory-display" tabindex="0" style="white-space: pre-wrap; word-break: break-word;">
        {{ content || "Your vault history is empty." }}
      </div>
    </div>
  </section>
</template>