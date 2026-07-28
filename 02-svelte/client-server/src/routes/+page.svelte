<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let clientClicks = $state(0);
	let sending = $state(false);
</script>

<svelte:head>
	<title>Cliente + servidor</title>
	<meta
		name="description"
		content="Una aplicación SvelteKit que combina código de servidor y código de navegador"
	/>
</svelte:head>

<main>
	<p class="eyebrow">Aplicación 2 · Cliente + servidor</p>
	<h1>Un viaje de ida y vuelta</h1>
	<p class="intro">
		La página llega renderizada desde el servidor y después Svelte la hace interactiva en el
		navegador.
	</p>

	<div class="grid">
		<section class="card server">
			<p class="tag">Servidor</p>
			<h2>Datos de la petición</h2>
			<dl>
				<div>
					<dt>Hora del servidor</dt>
					<dd>{data.serverTime}</dd>
				</div>
				<div>
					<dt>Dirección del cliente</dt>
					<dd>{data.clientAddress}</dd>
				</div>
			</dl>

			<form
				method="POST"
				action="?/greet"
				use:enhance={() => {
					sending = true;
					return async ({ update }) => {
						await update();
						sending = false;
					};
				}}
			>
				<label for="name">Tu nombre</label>
				<div class="form-row">
					<input id="name" name="name" value={form?.name ?? ''} autocomplete="name" />
					<button disabled={sending}>{sending ? 'Enviando…' : 'Saludar'}</button>
				</div>
				{#if form?.missing}
					<p class="error">Escribe un nombre antes de enviar.</p>
				{/if}
			</form>

			{#if form?.success}
				<div class="result" aria-live="polite">
					<strong>{form.message}</strong>
					<small>Respondido a las {form.answeredAt}</small>
				</div>
			{/if}
		</section>

		<section class="card client">
			<p class="tag">Cliente</p>
			<h2>Estado en el navegador</h2>
			<p>Este botón no contacta al servidor. Solo actualiza una variable reactiva local.</p>
			<button class="clicker" onclick={() => clientClicks++}>
				Clics locales: {clientClicks}
			</button>
		</section>
	</div>

	<section class="flow">
		<h2>Sigue el recorrido</h2>
		<ol>
			<li><code>+page.server.ts</code> prepara datos y el HTML inicial.</li>
			<li>El navegador recibe el HTML y Svelte hidrata la página.</li>
			<li>El formulario ejecuta una acción en el servidor.</li>
			<li><code>use:enhance</code> actualiza la respuesta sin recargar toda la página.</li>
		</ol>
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(:root) {
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		color: #1c2440;
		background: #f4f6fc;
	}

	:global(body) {
		margin: 0;
		min-width: 20rem;
		min-height: 100vh;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	main {
		width: min(62rem, calc(100% - 2rem));
		margin: 0 auto;
		padding: 4rem 0;
	}

	.eyebrow,
	.tag {
		color: #5b55c9;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
	}

	h1 {
		max-width: 42rem;
		margin: 0;
		font-size: clamp(2.4rem, 7vw, 4.5rem);
		letter-spacing: -0.055em;
		line-height: 1;
	}

	.intro {
		max-width: 42rem;
		margin: 1.25rem 0 2rem;
		color: #626b86;
		font-size: 1.05rem;
		line-height: 1.7;
	}

	.grid {
		display: grid;
		grid-template-columns: 1.35fr 1fr;
		gap: 1rem;
	}

	.card,
	.flow {
		border: 1px solid #dfe3f1;
		border-radius: 1.25rem;
		background: white;
		box-shadow: 0 1rem 3rem rgb(37 46 89 / 8%);
	}

	.card {
		padding: 1.75rem;
	}

	.card h2,
	.flow h2 {
		margin: 0.35rem 0 1rem;
	}

	.tag {
		margin: 0;
	}

	dl {
		display: grid;
		gap: 0.6rem;
		margin: 0 0 1.5rem;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid #edf0f8;
		padding-bottom: 0.6rem;
	}

	dt {
		color: #747c95;
	}

	dd {
		margin: 0;
		font-weight: 700;
	}

	label {
		display: block;
		margin-bottom: 0.4rem;
		font-weight: 700;
	}

	.form-row {
		display: flex;
		gap: 0.5rem;
	}

	input {
		min-width: 0;
		flex: 1;
		border: 1px solid #bfc5d9;
		border-radius: 0.65rem;
		padding: 0.7rem 0.8rem;
	}

	button {
		border: 0;
		border-radius: 0.65rem;
		background: #5b55c9;
		padding: 0.7rem 1rem;
		color: white;
		font-weight: 700;
		cursor: pointer;
	}

	button:hover {
		background: #4741ad;
	}

	button:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.client {
		background: #262b46;
		color: white;
	}

	.client .tag {
		color: #aca8ff;
	}

	.client p:not(.tag) {
		color: #c9cde0;
		line-height: 1.6;
	}

	.clicker {
		width: 100%;
		margin-top: 1rem;
		background: #efb24f;
		color: #33250e;
	}

	.clicker:hover {
		background: #ffc66b;
	}

	.error {
		margin: 0.5rem 0 0;
		color: #b42318;
		font-size: 0.9rem;
	}

	.result {
		display: grid;
		gap: 0.25rem;
		margin-top: 1rem;
		border-radius: 0.75rem;
		background: #eeedff;
		padding: 0.9rem;
		color: #37318f;
	}

	.result small {
		color: #6d69a5;
	}

	.flow {
		margin-top: 1rem;
		padding: 1.5rem 1.75rem;
	}

	.flow ol {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin: 0;
		padding-left: 1.5rem;
		color: #626b86;
		line-height: 1.55;
	}

	code {
		border-radius: 0.3rem;
		background: #eceeff;
		padding: 0.1rem 0.3rem;
		color: #453fa8;
		font-size: 0.9em;
	}

	@media (max-width: 45rem) {
		.grid,
		.flow ol {
			grid-template-columns: 1fr;
		}
	}
</style>
