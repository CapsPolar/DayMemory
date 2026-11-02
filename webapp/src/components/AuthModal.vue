<!-- AuthModal.vue -->
<script setup lang="ts">
import { computed } from "vue";

interface BufferSection {
  timestamp: string;
  text: string;
}

const props = defineProps<{
  firstTime: boolean;
  mode: "buffer" | "unlock";
  password: string;
  bufferText: string;
  bufferSaveStatus: string;
  unlocking: boolean;
}>();

const emit = defineEmits<{
  unlock: [];
  "update:password": [value: string];
  "update:bufferText": [value: string];
  toggleMode: [];
}>();

const bufferSections = computed<BufferSection[]>(() => {
  const parts = props.bufferText.split(/(\[TIME\s+[^\]]+\]:)/g);
  if (parts.length === 1) return [{ timestamp: "", text: parts[0] }];

  const sections: BufferSection[] = [];
  if (parts[0]) sections.push({ timestamp: "", text: parts[0] });
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ timestamp: parts[i], text: parts[i + 1] || "" });
  }
  return sections;
});

// Whitespace after a timestamp tag is kept in the stored text but hidden in the
// textarea, so an empty section is truly empty and shows its placeholder.
function leadingSpace(text: string): string {
  return text.match(/^\s*/)?.[0] ?? "";
}

function updateBufferSection(index: number, typed: string): void {
  const updatedSections = bufferSections.value.map((section, sectionIndex) =>
    sectionIndex === index ? { ...section, text: leadingSpace(section.text) + typed } : section
  );
  emit(
    "update:bufferText",
    updatedSections.map(section => section.timestamp + section.text).join("")
  );
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Write</h1>
      <span v-if="bufferSaveStatus" class="status">{{ bufferSaveStatus }}</span>
    </header>

    <form v-if="mode === 'unlock'" class="view unlock" @submit.prevent="emit('unlock')">
      <h2>Unlock vault</h2>
      <p>Your writing is encrypted and added to your vault once you unlock it.</p>
      <input
        id="password-input"
        :value="password"
        type="password"
        placeholder="Master password"
        aria-label="Master password"
        required
        autocomplete="off"
        :disabled="unlocking"
        @input="emit('update:password', ($event.target as HTMLInputElement).value)"
      />
      <button type="submit" class="btn" :disabled="unlocking">
        {{ unlocking ? "Unlocking…" : "Unlock" }}
      </button>
      <button type="button" class="text-btn muted" @click="emit('toggleMode')">Cancel</button>
    </form>

    <main v-else class="view write">
      <template v-for="(section, index) in bufferSections" :key="index">
        <p v-if="section.timestamp" class="entry-time">{{ section.timestamp }}</p>
        <textarea
          :id="index === 0 ? 'buffer-input' : undefined"
          :value="section.text.slice(leadingSpace(section.text).length)"
          :placeholder="index === bufferSections.length - 1 ? 'Write here' : undefined"
          class="write-area"
          :aria-label="`Writing section ${index + 1}`"
          @input="updateBufferSection(index, ($event.target as HTMLTextAreaElement).value)"
        />
      </template>
    </main>

    <button
      v-if="mode === 'buffer'"
      type="button"
      class="fab"
      aria-label="Unlock Vault"
      @click="emit('toggleMode')"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      </svg>
      Unlock Vault
    </button>
  </div>
</template>