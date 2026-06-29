<script setup lang="ts">
import { RouterLink } from 'vue-router';

defineProps<{
  title?: string;
}>();
</script>

<template>
  <header class="app-header">
    <div class="container">
      <RouterLink to="/" class="logo">
        <h1>{{ title || '短视频文案助手' }}</h1>
      </RouterLink>

      <nav class="nav">
        <RouterLink to="/" class="nav-link">首页</RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 16;
}

.logo {
  text-decoration: none;
}

.logo h1 {
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 700;
}

.nav {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  text-decoration: none;
  color: #4b5563;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.nav-link.router-link-exact-active,
.nav-link:hover {
  color: #3b82f6;
  background-color: #eff6ff;
}
</style>