# Aplicación cliente + servidor

Ejemplo pequeño de una aplicación SvelteKit con SSR, una función `load`, una acción de formulario y
estado reactivo en el navegador.

## Ejecutar

```sh
bun run dev
```

## Archivos para estudiar

- `src/routes/+page.server.ts`: solo se ejecuta en el servidor. Carga datos y procesa el formulario.
- `src/routes/+page.svelte`: se renderiza inicialmente en el servidor y se hidrata en el navegador.
- `use:enhance`: envía el formulario al servidor sin una recarga completa cuando JavaScript está activo.

Prueba desactivar JavaScript: la página y el formulario todavía funcionan, pero el botón de clics
locales deja de ser interactivo y el formulario vuelve a usar una recarga tradicional.
