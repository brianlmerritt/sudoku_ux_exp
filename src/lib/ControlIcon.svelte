<script lang="ts">
  let { name }: { name: 'undo' | 'redo' | 'erase' | 'unselect' } = $props()
</script>

<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'undo'}
    <path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)" />
  {:else if name === 'redo'}
    <path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12" transform="translate(0 -2)" />
  {:else if name === 'erase'}
    <path d="m4 13 9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8H8l-4-4a2 2 0 0 1 0-3Zm3-3 9 9M12 20h9" />
  {:else}
    <path d="M19 10V5H5v14h5m5-5 6 6m0-6-6 6" />
  {/if}
</svg>
