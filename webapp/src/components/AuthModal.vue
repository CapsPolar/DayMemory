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

function updateBufferSection(index: number, text: string): void {
  const updatedSections = bufferSections.value.map((section, sectionIndex) =>
    sectionIndex === index ? { ...section, text } : section
  );
  emit(
    "update:bufferText",
    updatedSections.map(section => section.timestamp + section.text).join("")
  );
}
</script>

<template>
  <div class="modal-overlay">
    <div class="modal-content auth-modal-content">
      <form v-if="mode === 'unlock'" @submit.prevent="emit('unlock')">
        <h2>Unlock Vault</h2>
        <p>Your continuous timeline remains zero-knowledge encrypted locally.</p>
        <p v-if="firstTime" class="status-msg first-time-hint">
          Set your vault password. You can always change it in settings.
        </p>
        <input
          id="password-input"
          :value="password"
          type="password"
          placeholder="Master Password"
          required
          autocomplete="off"
          :disabled="unlocking"
          @input="emit('update:password', ($event.target as HTMLInputElement).value)"
        />
        <button type="submit" :disabled="unlocking">
          {{ unlocking ? "Unlocking..." : "Unlock" }}
        </button>
      </form>

      <section v-else>
        <h2>Quick Buffer</h2>
        <p>
          Write freely without unlocking. Stored locally and unencrypted right
          here until you unlock the vault — then it's merged into your
          continuous timeline and cleared.
        </p>
        <div class="editor-card buffer-editor">
          <label for="buffer-input" class="field-label">Quick Thoughts (Buffer):</label>
          <div class="buffer-entries">
            <div
              v-for="(section, index) in bufferSections"
              :key="index"
              class="buffer-entry"
            >
              <textarea
                v-if="section.timestamp"
                :value="section.timestamp"
                class="buffer-timestamp-textarea"
                aria-label="Uneditable timestamp"
                readonly
                rows="1"
              />
              <textarea
                :id="index === 0 ? 'buffer-input' : undefined"
                :value="section.text"
                :placeholder="index === 0 ? 'Jot something down...' : undefined"
                class="buffer-textarea"
                :aria-label="`Quick thoughts ${index + 1}`"
                @input="updateBufferSection(index, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>
          </div>
          <span class="status-msg" aria-live="polite">{{ bufferSaveStatus }}</span>
        </div>
      </section>

      <button type="button" class="lock-view-toggle" @click="emit('toggleMode')">
        {{ mode === "buffer" ? "🔑 Switch to Unlock" : "📝 Switch to Buffer" }}
      </button>
    </div>
  </div>
</template>
