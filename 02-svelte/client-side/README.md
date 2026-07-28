# Aplicación solo cliente

Ejemplo pequeño de una SPA de SvelteKit que se ejecuta únicamente en el navegador.

## Ejecutar

```sh
bun run dev
```

Abre la dirección que aparece en la terminal. El archivo `src/routes/+layout.ts` desactiva SSR
con `ssr = false`, mientras que `adapter-static` genera archivos aptos para hosting estático.

## Archivos para estudiar

- `src/routes/+layout.ts`: convierte toda la aplicación en client-only.
- `src/routes/+page.svelte`: estado reactivo y eventos del navegador.
- `vite.config.ts`: configura una compilación estática con una página fallback.
