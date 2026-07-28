<script lang="ts">
	let count = $state(0);
	let steps = $state<number[]>([]);

	function changeCount(amount: number) {
		count += amount;
		steps.push(amount);
	}

	function reset() {
		count = 0;
		steps = [];
	}
</script>

<svelte:head>
	<title>Contador del cliente</title>
	<meta
		name="description"
		content="Una aplicación SvelteKit que se ejecuta únicamente en el navegador"
	/>
</svelte:head>

<main>
	<p class="eyebrow">Aplicación 1 · Solo cliente</p>
	<h1>Contador del navegador</h1>
	<p class="intro">
		Cada clic modifica estado local con <code>$state</code>. No se envía ninguna petición a un
		servidor.
	</p>

	<section class="counter" aria-labelledby="counter-label">
		<p id="counter-label">Valor actual</p>
		<strong aria-live="polite">{count}</strong>
		<div class="actions">
			<button onclick={() => changeCount(-1)} aria-label="Restar uno">−</button>
			<button onclick={() => changeCount(1)} aria-label="Sumar uno">+</button>
		</div>
		<button class="reset" onclick={reset} disabled={steps.length === 0}>Reiniciar</button>
	</section>

	<section class="explanation">
		<h2>¿Qué está ocurriendo?</h2>
		<ul>
			<li><code>+layout.ts</code> contiene <code>ssr = false</code>.</li>
			<li>El HTML inicial es una carcasa vacía; Svelte monta la interfaz en el navegador.</li>
			<li>El historial vive solamente en memoria y desaparece al recargar.</li>
		</ul>

		<h2>Historial de esta sesión</h2>
		{#if steps.length === 0}
			<p class="empty">Todavía no has cambiado el contador.</p>
		{:else}
			<ol aria-label="Cambios realizados">
				{#each steps as step, index (index)}
					<li>{step > 0 ? '+1' : '−1'}</li>
				{/each}
			</ol>
		{/if}
	</section>
</main>
