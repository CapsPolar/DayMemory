<!-- ThoughtsView.vue -->
<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from "vue";

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

// Long-press timer tracking
let longPressTimer: number | null = null;

function scrollToBottom(): void {
  nextTick(() => {
    const container = document.querySelector(".view") || window;
    if (container instanceof HTMLElement) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
      });
    }
  });
}

onMounted(() => {
  scrollToBottom();
});

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
  cancelEditing();
}

// Event handlers for alternative triggers
function handleContextMenu(section: HistorySection, event: MouseEvent): void {
  event.preventDefault(); // Prevent the native browser context menu
  startEditing(section);
}

function startLongPress(section: HistorySection): void {
  cancelLongPress();
  longPressTimer = window.setTimeout(() => {
    startEditing(section);
  }, 600); // 600ms hold counts as long press
}

function cancelLongPress(): void {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}
</script>

<template>
  <div v-if="content" class="search">
    <input
      v-model="searchQuery"
      type="search"
      placeholder="Search history"
      aria-label="Search history"
    />
    <span class="search-count" aria-live="polite">
      <template v-if="searchQuery.trim()">
        {{ totalMatches > 0 ? `${activeMatchIndex + 1} of ${totalMatches}` : "No results" }}
      </template>
    </span>
    <button
      type="button"
      class="icon-btn"
      :disabled="totalMatches === 0"
      aria-label="Previous match"
      @click="prevMatch"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 15 12 9 18 15" /></svg>
    </button>
    <button
      type="button"
      class="icon-btn"
      :disabled="totalMatches === 0"
      aria-label="Next match"
      @click="nextMatch"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
    </button>
  </div>

  <p v-if="!content" class="empty">Your vault history is empty.</p>

  <article
    v-for="section in displaySections"
    :key="section.id"
    class="entry"
    @dblclick="startEditing(section)"
    @contextmenu="handleContextMenu(section, $event)"
    @touchstart="startLongPress(section)"
    @touchend="cancelLongPress"
    @touchmove="cancelLongPress"
    @mousedown="startLongPress(section)"
    @mouseup="cancelLongPress"
    @mouseleave="cancelLongPress"
  >
    <p class="entry-text">
      <span v-if="section.timestamp" class="entry-time">
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
    </p>
    <button type="button" class="text-btn" aria-label="Edit entry" @click.stop="startEditing(section)">
      Edit
    </button>
  </article>

  <Teleport to="body">
    <Transition name="sheet-slide">
      <div v-if="editingSectionId" class="sheet-backdrop" @click.self="cancelEditing">
        <div class="sheet">
          <div class="sheet-handle" />
          <header class="app-header">
            <button
              type="button"
              class="sheet-action-btn cancel"
              aria-label="Cancel editing"
              @click="cancelEditing"
            >
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h1>Edit entry</h1>

            <button
              type="button"
              class="sheet-action-btn submit"
              aria-label="Save changes"
              @click="editingSection && saveSection(editingSection)"
            >
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </header>

          <p v-if="editTimestamp" class="entry-time">{{ editTimestamp }}</p>
          <textarea v-model="editText" aria-label="Entry content" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>