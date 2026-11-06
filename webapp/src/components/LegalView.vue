<!-- LegalView.vue -->
<script setup lang="ts">
defineProps<{
  showBack?: boolean;
}>();

defineEmits<{
  back: [];
}>();
</script>

<template>
  <div class="app">
    <header class="app-header">
      <button v-if="showBack" type="button" class="text-btn" @click="$emit('back')">Back</button>
      <h1 v-else>Legal & Terms</h1>
    </header>

    <main class="view" style="padding: 20px; line-height: 1.6; font-size: 14px;">
      <section style="margin-bottom: 24px;">
        <h2>Disclaimer of Warranties</h2>
        <p style="margin-top: 8px; opacity: 0.85;">
          DayMemory is provided on an "as is" and "as available" basis, without warranties of any kind, whether express or implied. We guarantee nothing regarding uptime, data integrity, or compatibility.
        </p>
      </section>

      <section style="margin-bottom: 24px;">
        <h2>Limitation of Liability</h2>
        <p style="margin-top: 8px; opacity: 0.85;">
          You use DayMemory entirely at your own risk. In no event shall the authors or contributors be liable for any direct, indirect, incidental, or consequential damages resulting from data loss, corruption, or security breaches.
        </p>
      </section>

      <section style="margin-bottom: 24px;">
        <h2>Your Data & Responsibility</h2>
        <p style="margin-top: 8px; opacity: 0.85;">
          All your notes and history are stored locally on your device or in your browser's IndexedDB. You are solely responsible for maintaining secure backups and keeping your master password safe. If you lose your password or browser storage is wiped, your data cannot be recovered by anyone else.
        </p>
      </section>
    </main>
  </div>
</template>