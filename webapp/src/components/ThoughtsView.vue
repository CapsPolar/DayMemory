<script setup lang="ts">
defineProps<{
  modelValue: string;
  saveStatus: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <section class="nav-view-panel active">
    <div class="editor-card">
      <label for="memory-input" class="memory-label">
        Continuous Stream of Thoughts:
      </label>
      <textarea
        id="memory-input"
        :value="modelValue"
        placeholder="Write your thoughts freely here..."
        class="memory-textarea"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      />
      <span class="status-msg" aria-live="polite">{{ saveStatus }}</span>
    </div>
  </section>
</template>
