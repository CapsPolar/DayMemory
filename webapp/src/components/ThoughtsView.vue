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

interface DisplaySection extends HistorySection {
  timestamp: string;
  text: string;
}

const editingSectionId = ref<string | null>(null);
const editTimestamp = ref("");
const editText = ref("");

function splitIntoSections(text: string): string[] {
  if (!text) return [""];

  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const chunks: string[] = [];
  let currentText = "";
  let currentLineCount = 0;
  let currentWordCount = 0;

  const flush = () => {
    if (currentLineCount === 0) return;
    chunks.push(currentText);
    currentText = "";
    currentLineCount = 0;
    currentWordCount = 0;
  };

  for (const line of lines) {
    const hasLineEnding = line.endsWith("\n");
    const content = hasLineEnding ? line.slice(0, -1) : line;
    const tokens = content.match(/\S+|\s+/g) || [];
    const lineChunks: string[] = [];
    let lineChunk = "";
    let lineChunkWords = 0;

    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        lineChunk += token;
        continue;
      }

      if (lineChunkWords === 200) {
        lineChunks.push(lineChunk);
        lineChunk = "";
        lineChunkWords = 0;
      }
      lineChunk += token;
      lineChunkWords++;
    }

    if (hasLineEnding) lineChunk += "\n";
    lineChunks.push(lineChunk);

    for (const lineChunk of lineChunks) {
      const lineWords = (lineChunk.match(/\S+/g) || []).length;
      if (
        currentLineCount > 0 &&
        (currentLineCount >= 20 || currentWordCount + lineWords > 200)
      ) {
        flush();
      }

      currentText += lineChunk;
      currentLineCount++;
      currentWordCount += lineWords;
    }
  }

  flush();
  return chunks;
}

const sections = computed<HistorySection[]>(() => {
  const text = props.content;
  if (!text) return [];

  const timeTagRegex = /(\[TIME\s+[^\]]+\]:)/g;
  const parts = text.split(timeTagRegex);
  const sourceSections: { timestamp: string; text: string }[] = [];

  if (parts[0] && parts[0].trim().length > 0) {
    sourceSections.push({ timestamp: "", text: parts[0] });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const tag = parts[i];
    if (tag) sourceSections.push({ timestamp: tag, text: parts[i + 1] || "" });
  }

  const result: HistorySection[] = [];
  for (const section of sourceSections) {
    const chunks = splitIntoSections(section.text);
    chunks.forEach((chunk, index) => {
      result.push({
        id: `sec-${result.length}`,
        fullText: (index === 0 ? section.timestamp : "") + chunk
      });
    });
  }

  return result;
});

const displaySections = computed<DisplaySection[]>(() =>
  sections.value.map(section => {
    const timestamp = section.fullText.match(/^(\[TIME\s+[^\]]+\]:)/)?.[0] || "";
    return {
      ...section,
      timestamp,
      text: section.fullText.slice(timestamp.length)
    };
  })
);

const editingSection = computed(() =>
  sections.value.find(section => section.id === editingSectionId.value)
);

function startEditing(section: HistorySection): void {
  editingSectionId.value = section.id;
  const timestamp = section.fullText.match(/^(\[TIME\s+[^\]]+\]:)/);
  editTimestamp.value = timestamp?.[0] || "";
  editText.value = section.fullText.slice(editTimestamp.value.length);
}

function cancelEditing(): void {
  editingSectionId.value = null;
  editTimestamp.value = "";
  editText.value = "";
}

function saveSection(section: HistorySection): void {
  const updatedSections = sections.value.map(sec => {
    if (sec.id === section.id) {
      return { ...sec, fullText: editTimestamp.value + editText.value };
    }
    return sec;
  });

  const newContent = updatedSections.map(s => s.fullText).join("");

  emit("update:content", newContent);
  editingSectionId.value = null;
  editTimestamp.value = "";
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
          v-for="section in displaySections"
          :key="section.id"
          class="history-section-block"
        >
          <div class="memory-display section-text" tabindex="0">
            <span v-if="section.timestamp" class="section-timestamp">
              {{ section.timestamp }}
            </span>
            <span>{{ section.text }}</span>
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
          v-if="editTimestamp"
          :value="editTimestamp"
          class="section-timestamp-textarea"
          aria-label="Uneditable timestamp"
          readonly
          rows="1"
        />
        <textarea
          v-model="editText"
          class="backup-textarea section-editor-textarea"
          aria-label="Timeline section content"
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