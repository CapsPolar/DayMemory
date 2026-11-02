<!-- ThoughtsView.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  content: string;
}>();

const emit = defineEmits<{
  "update:content": [value: string];
}>();

interface HistorySection {
  id: string;
  fullText: string;
}

const editingSectionId = ref<string | null>(null);
const editText = ref("");

const sections = computed<HistorySection[]>(() => {
  const text = props.content;
  if (!text) return [];

  const timeTagRegex = /(\[TIME\s+[^\]]+\]:)/g;
  const parts = text.split(timeTagRegex);

  const result: HistorySection[] = [];
  let startIndex = 0;

  if (parts[0] && parts[0].trim().length > 0) {
    result.push({
      id: "sec-0",
      fullText: parts[0]
    });
  }
  startIndex = 1;

  let secId = result.length;
  for (let i = startIndex; i < parts.length; i += 2) {
    const tag = parts[i];
    const body = parts[i + 1] || "";
    if (tag) {
      result.push({
        id: `sec-${secId++}`,
        fullText: tag + body
      });
    }
  }

  // Fallback if no time tags are found: split after 10 lines or 200 words
  if (result.length === 0 && text.trim().length > 0) {
    const lines = text.split("\n");
    let currentLines: string[] = [];
    let currentWordCount = 0;

    for (const line of lines) {
      const lineWords = line.trim() ? line.trim().split(/\s+/).length : 0;
      if (currentLines.length >= 10 || (currentWordCount + lineWords > 200 && currentLines.length > 0)) {
        result.push({
          id: `sec-chunk-${result.length}`,
          fullText: currentLines.join("\n")
        });
        currentLines = [line];
        currentWordCount = lineWords;
      } else {
        currentLines.push(line);
        currentWordCount += lineWords;
      }
    }
    if (currentLines.length > 0) {
      result.push({
        id: `sec-chunk-${result.length}`,
        fullText: currentLines.join("\n")
      });
    }
  }

  return result;
});

const editingSection = computed(() =>
  sections.value.find(section => section.id === editingSectionId.value)
);

function startEditing(section: HistorySection): void {
  editingSectionId.value = section.id;
  editText.value = section.fullText;
}

function cancelEditing(): void {
  editingSectionId.value = null;
  editText.value = "";
}

function saveSection(section: HistorySection): void {
  const updatedSections = sections.value.map(sec => {
    if (sec.id === section.id) {
      return { ...sec, fullText: editText.value };
    }
    return sec;
  });

  const hasTimeTags = props.content.includes("[TIME ");
  const newContent = hasTimeTags
    ? updatedSections.map(s => s.fullText).join("")
    : updatedSections.map(s => s.fullText).join("\n");

  emit("update:content", newContent);
  editingSectionId.value = null;
  editText.value = "";
}
</script>

<template>
  <section class="nav-view-panel active">
    <div class="editor-card history-card">
      <div class="history-header">
        <span class="memory-label">Continuous Timeline History:</span>
      </div>

      <div v-if="!content" class="memory-display" tabindex="0">
        Your vault history is empty.
      </div>

      <div v-else class="history-sections-container">
        <div
          v-for="section in sections"
          :key="section.id"
          class="history-section-block"
        >
          <div class="memory-display section-text" tabindex="0">
            {{ section.fullText }}
          </div>
          <div class="section-actions">
            <button
              type="button"
              class="secondary-btn edit-section-btn"
              :aria-label="`Edit section ${section.id}`"
              @click="startEditing(section)"
            >
              Edit section
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="editingSectionId" class="section-editor-overlay">
        <div class="section-editor-header">
          <h2>Edit timeline section</h2>
        </div>
        <textarea
          v-model="editText"
          class="backup-textarea section-editor-textarea"
          aria-label="Timeline section text"
        />
        <div class="section-editor-actions">
          <button
            type="button"
            class="secondary-btn"
            @click="cancelEditing"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="editingSection && saveSection(editingSection)"
          >
            Save
          </button>
        </div>
      </div>
    </Teleport>
  </section>
</template>