<script setup lang="ts">
defineProps<{
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
          <textarea
            id="buffer-input"
            :value="bufferText"
            placeholder="Jot something down..."
            class="buffer-textarea"
            @input="emit('update:bufferText', ($event.target as HTMLTextAreaElement).value)"
          />
          <span class="status-msg" aria-live="polite">{{ bufferSaveStatus }}</span>
        </div>
      </section>

      <button type="button" class="lock-view-toggle" @click="emit('toggleMode')">
        {{ mode === "buffer" ? "🔑 Switch to Unlock" : "📝 Switch to Buffer" }}
      </button>
    </div>
  </div>
</template>
