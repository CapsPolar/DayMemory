<!-- AuthModal.vue -->
<script setup lang="ts">
import { computed } from "vue";

interface WritingSpaceSection {
  timestamp: string;
  text: string;
}

const props = defineProps<{
  firstTime: boolean;
  importing?: string | null;
  mode: "writingSpace" | "unlock";
  password: string;
  writingSpaceText: string;
  writingSpaceSaveStatus: string;
  unlocking: boolean;
}>();

const emit = defineEmits<{
  unlock: [];
  "update:password": [value: string];
  "update:writingSpaceText": [value: string];
  toggleMode: [];
  openFirstTimeImport: [];
  openLockedExport: [];
}>();

const authTitle = computed(() => {
  if (props.importing === "plain") return "Set password";
  if (props.importing === "vault") return "Unlock vault";
  return props.firstTime ? "Set password" : "Unlock vault";
});

const authHint = computed(() => {
  if (props.importing === "plain") return "Import complete, now please set a password";
  if (props.importing === "vault") return "Import complete, now enter the vault password";
  return props.firstTime ? "You can always change it later." : "Your writings are encrypted and added to your vault once you unlock it.";
});

const authPlaceholder = computed(() => {
  if (props.importing === "plain") return "New password";
  if (props.importing === "vault") return "Vault password";
  return props.firstTime ? "New password" : "Master password";
});

const writingSpaceSections = computed<WritingSpaceSection[]>(() => {
  const parts = props.writingSpaceText.split(/(\[TIME\s+[^\]]+\]:)/g);
  if (parts.length === 1) return [{ timestamp: "", text: parts[0] }];

  const sections: WritingSpaceSection[] = [];
  if (parts[0]) sections.push({ timestamp: "", text: parts[0] });
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ timestamp: parts[i], text: parts[i + 1] || "" });
  }
  return sections;
});

function leadingSpace(text: string): string {
  return text.match(/^\s*/)?.[0] ?? "";
}

function updateWritingSpaceSection(index: number, typed: string): void {
  const updatedSections = writingSpaceSections.value.map((section, sectionIndex) =>
    sectionIndex === index ? { ...section, text: leadingSpace(section.text) + typed } : section
  );
  emit(
    "update:writingSpaceText",
    updatedSections.map(section => section.timestamp + section.text).join("")
  );
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Writing space</h1>
      <span v-if="writingSpaceSaveStatus" class="status">{{ writingSpaceSaveStatus }}</span>
    </header>

    <main class="view write">
      <template v-for="(section, index) in writingSpaceSections" :key="index">
        <p v-if="section.timestamp" class="entry-time">{{ section.timestamp }}</p>
        <textarea
          :id="index === 0 ? 'buffer-input' : undefined"
          :value="section.text.slice(leadingSpace(section.text).length)"
          :placeholder="index === writingSpaceSections.length - 1 ? 'Write here' : undefined"
          class="write-area"
          :aria-label="`Writing section ${index + 1}`"
          @input="updateWritingSpaceSection(index, ($event.target as HTMLTextAreaElement).value)"
        />
      </template>
    </main>

    <button
      v-if="mode === 'writingSpace' && !importing"
      type="button"
      class="fab"
      :aria-label="firstTime ? 'Encrypt writing space' : 'Unlock Vault'"
      @click="emit('toggleMode')"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      </svg>
      {{ firstTime ? "Encrypt thoughts" : "Unlock Vault" }}
    </button>

    <Transition name="sheet-slide">
      <div
        v-if="mode === 'unlock' || importing"
        class="sheet-backdrop"
        @click.self="!importing && emit('toggleMode')"
      >
        <div class="sheet auth-sheet">
          <div class="sheet-handle" />

          <form class="sheet-form" @submit.prevent="emit('unlock')">
            <header class="app-header">
              <button
                v-if="!importing"
                type="button"
                class="sheet-action-btn cancel"
                aria-label="Close"
                @click="emit('toggleMode')"
              >
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div v-else style="width: 36px;" />

              <h1>{{ authTitle }}</h1>

              <button
                type="submit"
                class="sheet-action-btn submit"
                aria-label="Submit password"
                :disabled="unlocking"
              >
                <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </header>

            <div class="sheet-content">
              <p class="hint">{{ authHint }}</p>
              <input
                id="password-input"
                :value="password"
                type="password"
                :placeholder="authPlaceholder"
                :aria-label="authPlaceholder"
                required
                autocomplete="off"
                :disabled="unlocking"
                @input="emit('update:password', ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="firstTime && !importing"
                type="button"
                class="text-btn muted"
                @click="emit('openFirstTimeImport')"
              >
                Looking to restore your vault? Import vault
              </button>
              <button
                v-if="!firstTime && importing !== 'plain'"
                type="button"
                class="text-btn muted"
                @click="emit('openLockedExport')"
              >
                Export encrypted vault string
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>