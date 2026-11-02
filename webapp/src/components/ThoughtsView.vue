<!-- ThoughtsView.vue -->
<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";

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

interface MatchLocation {
  sectionId: string;
  type: "timestamp" | "text";
  start: number;
  end: number;
}

const editingSectionId = ref<string | null>(null);
const editTimestamp = ref("");
const editText = ref("");

// Search State
const searchQuery = ref("");
const activeMatchIndex = ref(0);

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

// Precompute all match positions globally for foolproof indexing
const allMatches = computed<MatchLocation[]>(() => {
  const query = searchQuery.value.trim();
  if (!query) return [];

  const matches: MatchLocation[] = [];
  const lowerQuery = query.toLowerCase();

  for (const section of displaySections.value) {
    // Check timestamp
    if (section.timestamp) {
      const lowerTs = section.timestamp.toLowerCase();
      let pos = lowerTs.indexOf(lowerQuery);
      while (pos !== -1) {
        matches.push({
          sectionId: section.id,
          type: "timestamp",
          start: pos,
          end: pos + query.length
        });
        pos = lowerTs.indexOf(lowerQuery, pos + query.length);
      }
    }

    // Check text
    if (section.text) {
      const lowerText = section.text.toLowerCase();
      let pos = lowerText.indexOf(lowerQuery);
      while (pos !== -1) {
        matches.push({
          sectionId: section.id,
          type: "text",
          start: pos,
          end: pos + query.length
        });
        pos = lowerText.indexOf(lowerQuery, pos + query.length);
      }
    }
  }

  return matches;
});

const totalMatches = computed(() => allMatches.value.length);

watch(searchQuery, () => {
  activeMatchIndex.value = 0;
  scrollToActiveMatch();
});

function nextMatch(): void {
  if (totalMatches.value === 0) return;
  activeMatchIndex.value = (activeMatchIndex.value + 1) % totalMatches.value;
  scrollToActiveMatch();
}

function prevMatch(): void {
  if (totalMatches.value === 0) return;
  activeMatchIndex.value =
    (activeMatchIndex.value - 1 + totalMatches.value) % totalMatches.value;
  scrollToActiveMatch();
}

function scrollToActiveMatch(): void {
  nextTick(() => {
    const el = document.querySelector(".search-highlight.active");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

// Helper to check if a specific slice of text is the active match
function isMatchActive(sectionId: string, type: "timestamp" | "text", startIndex: number, length: number): boolean {
  const currentMatch = allMatches.value[activeMatchIndex.value];
  if (!currentMatch) return false;

  return (
    currentMatch.sectionId === sectionId &&
    currentMatch.type === type &&
    currentMatch.start === startIndex
  );
}

function renderSegments(sectionId: string, type: "timestamp" | "text", fullText: string) {
  const query = searchQuery.value.trim();
  if (!query || !fullText) {
    return [{ text: fullText, isMatch: false, start: 0 }];
  }

  const segments: { text: string; isMatch: boolean; start: number }[] = [];
  const lowerText = fullText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let currentIndex = 0;

  let matchPos = lowerText.indexOf(lowerQuery, currentIndex);
  while (matchPos !== -1) {
    if (matchPos > currentIndex) {
      segments.push({
        text: fullText.slice(currentIndex, matchPos),
        isMatch: false,
        start: currentIndex
      });
    }

    segments.push({
      text: fullText.slice(matchPos, matchPos + query.length),
      isMatch: true,
      start: matchPos
    });

    currentIndex = matchPos + query.length;
    matchPos = lowerText.indexOf(lowerQuery, currentIndex);
  }

  if (currentIndex < fullText.length) {
    segments.push({
      text: fullText.slice(currentIndex),
      isMatch: false,
      start: currentIndex
    });
  }

  return segments;
}

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

      <!-- Sticky Search Bar Toolbar -->
      <div v-if="content" class="search-bar sticky-search">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search history..."
          aria-label="Search timeline history"
          class="search-input"
        />
        <div class="search-controls">
          <span class="search-counter" aria-live="polite">
            <template v-if="searchQuery.trim()">
              {{ totalMatches > 0 ? `${activeMatchIndex + 1} of ${totalMatches}` : 'No results' }}
            </template>
          </span>
          <button
            type="button"
            class="secondary-btn search-nav-btn"
            :disabled="totalMatches === 0"
            aria-label="Previous match"
            @click="prevMatch"
          >
            ▲
          </button>
          <button
            type="button"
            class="secondary-btn search-nav-btn"
            :disabled="totalMatches === 0"
            aria-label="Next match"
            @click="nextMatch"
          >
            ▼
          </button>
        </div>
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
            <!-- Timestamp displaying with highlights -->
            <span v-if="section.timestamp" class="section-timestamp">
              <template
                v-for="(seg, idx) in renderSegments(section.id, 'timestamp', section.timestamp)"
                :key="idx"
              >
                <mark
                  v-if="seg.isMatch"
                  class="search-highlight"
                  :class="{ active: isMatchActive(section.id, 'timestamp', seg.start, seg.text.length) }"
                >{{ seg.text }}</mark>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>

            <!-- Main text displaying with highlights -->
            <span>
              <template
                v-for="(seg, idx) in renderSegments(section.id, 'text', section.text)"
                :key="idx"
              >
                <mark
                  v-if="seg.isMatch"
                  class="search-highlight"
                  :class="{ active: isMatchActive(section.id, 'text', seg.start, seg.text.length) }"
                >{{ seg.text }}</mark>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>
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

<style scoped>
.sticky-search {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--card-bg, #ffffff);
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, #eee);
  margin-bottom: 1rem;
}

.search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.search-counter {
  font-size: 0.85rem;
  margin-right: 0.5rem;
  white-space: nowrap;
}

.search-nav-btn {
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
}

mark.search-highlight {
  background-color: #ffe066; /* Yellow for non-active matches */
  color: #000;
  border-radius: 2px;
  padding: 0 1px;
}

mark.search-highlight.active {
  background-color: #ff922b; /* Orange for the currently selected match */
  color: #fff;
}
</style>