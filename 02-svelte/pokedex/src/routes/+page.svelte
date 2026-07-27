<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const API_BASE = 'https://pokeapi.co/api/v2';
	const ROSTER_CACHE_KEY = 'trainer-terminal:pokemon-species:v1';

	type RosterPokemon = { name: string; url: string; id: number };
	type PokemonType = { slot: number; type: { name: string } };
	type Pokemon = {
		id: number;
		name: string;
		types: PokemonType[];
		sprites: {
			front_default: string | null;
			versions?: {
				'generation-v'?: { 'black-white'?: { front_default: string | null } };
			};
			other?: { 'official-artwork'?: { front_default: string | null } };
		};
	};

	let allPokemon: RosterPokemon[] = $state.raw([]);
	let query = $state('');
	let selectedName = $state('');
	let selectedPokemon: Pokemon | null = $state.raw(null);
	let rosterStatus: 'loading' | 'ready' | 'error' = $state('loading');
	let detailStatus: 'loading' | 'ready' | 'error' = $state('loading');
	let detailRequest: AbortController | null = null;

	const detailCache = new SvelteMap<string, Pokemon>();
	let filteredPokemon = $derived.by(() => {
		const search = query.trim().toLowerCase().replace(/^#/, '');
		return allPokemon.filter((pokemon) => {
			const displayName = formatName(pokemon.name).toLowerCase();
			return (
				pokemon.name.includes(search) ||
				displayName.includes(search) ||
				String(pokemon.id).startsWith(search)
			);
		});
	});
	let selectedRosterPokemon = $derived(allPokemon.find((pokemon) => pokemon.name === selectedName));

	function getIdFromUrl(url: string) {
		const match = url.match(/\/(\d+)\/?$/);
		return match ? Number(match[1]) : 0;
	}

	function formatNumber(id = 0) {
		return id ? `#${String(id).padStart(4, '0')}` : '#----';
	}

	function formatName(name: string) {
		return name
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function readCachedRoster(): RosterPokemon[] | null {
		try {
			const cached = sessionStorage.getItem(ROSTER_CACHE_KEY);
			if (!cached) return null;
			const parsed: unknown = JSON.parse(cached);
			return Array.isArray(parsed) ? (parsed as RosterPokemon[]) : null;
		} catch {
			return null;
		}
	}

	function cacheRoster(roster: RosterPokemon[]) {
		try {
			sessionStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify(roster));
		} catch {
			// Storage is an optional optimization.
		}
	}

	async function fetchRoster(): Promise<RosterPokemon[]> {
		const cached = readCachedRoster();
		if (cached) return cached;

		const countResponse = await fetch(`${API_BASE}/pokemon-species?limit=1`);
		if (!countResponse.ok) throw new Error('The national index did not respond.');
		const { count } = (await countResponse.json()) as { count: number };

		const rosterResponse = await fetch(`${API_BASE}/pokemon-species?limit=${count}`);
		if (!rosterResponse.ok) throw new Error('The full national index could not be retrieved.');
		const { results } = (await rosterResponse.json()) as {
			results: Array<Omit<RosterPokemon, 'id'>>;
		};
		const roster = results.map((pokemon) => ({
			...pokemon,
			id: getIdFromUrl(pokemon.url)
		}));
		cacheRoster(roster);
		return roster;
	}

	function getSprite(pokemon: Pokemon) {
		return (
			pokemon.sprites.versions?.['generation-v']?.['black-white']?.front_default ||
			pokemon.sprites.front_default ||
			pokemon.sprites.other?.['official-artwork']?.front_default ||
			''
		);
	}

	function useFallbackSprite(event: Event, pokemon: Pokemon) {
		const image = event.currentTarget as HTMLImageElement;
		if (pokemon.sprites.front_default && image.src !== pokemon.sprites.front_default) {
			image.src = pokemon.sprites.front_default;
		}
	}

	async function selectPokemon(name: string, button?: HTMLButtonElement) {
		if (!name) return;
		selectedName = name;
		selectedPokemon = null;

		if (button) {
			await tick();
			button.focus();
		}

		const cached = detailCache.get(name);
		if (cached) {
			selectedPokemon = cached;
			detailStatus = 'ready';
			return;
		}

		detailRequest?.abort();
		detailRequest = new AbortController();
		detailStatus = 'loading';

		try {
			const response = await fetch(`${API_BASE}/pokemon/${encodeURIComponent(name)}`, {
				signal: detailRequest.signal
			});
			if (!response.ok) throw new Error('The selected record did not respond.');
			const pokemon = (await response.json()) as Pokemon;
			detailCache.set(name, pokemon);
			if (selectedName === name) {
				selectedPokemon = pokemon;
				detailStatus = 'ready';
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			if (selectedName === name) detailStatus = 'error';
		}
	}

	async function loadPokedex() {
		detailRequest?.abort();
		rosterStatus = 'loading';
		detailStatus = 'loading';
		allPokemon = [];
		selectedPokemon = null;

		try {
			allPokemon = await fetchRoster();
			rosterStatus = 'ready';
			await selectPokemon('bulbasaur');
		} catch {
			rosterStatus = 'error';
			detailStatus = 'error';
		}
	}

	function handleRosterKeydown(event: KeyboardEvent, pokemon: RosterPokemon) {
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const current = filteredPokemon.findIndex((item) => item.name === pokemon.name);
		const last = filteredPokemon.length - 1;
		const next = {
			ArrowDown: Math.min(current + 1, last),
			ArrowUp: Math.max(current - 1, 0),
			Home: 0,
			End: last
		}[event.key];
		if (next === undefined) return;

		event.preventDefault();
		const nextPokemon = filteredPokemon[next];
		const nextButton = document.querySelector<HTMLButtonElement>(
			`[data-pokemon-name="${CSS.escape(nextPokemon.name)}"]`
		);
		void selectPokemon(nextPokemon.name, nextButton ?? undefined);
	}

	onMount(() => {
		void loadPokedex();
		return () => detailRequest?.abort();
	});
</script>

<svelte:head>
	<title>Pokédex // Trainer Terminal</title>
	<meta name="theme-color" content="#080808" />
	<meta name="description" content="A retro terminal Pokédex powered by PokéAPI." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="terminal" aria-labelledby="page-title">
	<header class="terminal-header">
		<div class="brand-lockup">
			<span class="brand-mark" aria-hidden="true"><i></i></span>
			<h1 id="page-title">POKÉDEX</h1>
		</div>
		<p class="connection-status">
			<span class="status-light" aria-hidden="true"></span> LINK ESTABLISHED
		</p>
	</header>

	<section class="terminal-titlebar" aria-label="Application information">
		<p>NATIONAL INDEX // TRAINER DATABASE</p>
		<p class="titlebar-right">V2.0 <span aria-hidden="true">//</span> ONLINE</p>
	</section>

	<div class="pokedex-layout">
		<section class="panel roster-panel" aria-labelledby="roster-title">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">DATABASE</p>
					<h2 id="roster-title">POKÉMON ROSTER</h2>
				</div>
				<p class="count-readout" aria-live="polite">
					{rosterStatus === 'ready'
						? `${allPokemon.length} FOUND`
						: rosterStatus === 'error'
							? 'OFFLINE'
							: 'CONNECTING'}
				</p>
			</div>

			<label class="search-field" for="pokemon-search">
				<span>SEARCH INDEX</span>
				<input
					id="pokemon-search"
					type="search"
					placeholder="NAME OR NUMBER"
					autocomplete="off"
					disabled={rosterStatus !== 'ready'}
					bind:value={query}
				/>
			</label>

			<div class="pokemon-list" aria-label="All Pokémon" aria-busy={rosterStatus === 'loading'}>
				{#if rosterStatus === 'loading'}
					<p class="roster-message">
						RETRIEVING NATIONAL INDEX<span class="loading-dots" aria-hidden="true">...</span>
					</p>
				{:else if rosterStatus === 'error'}
					<div class="detail-error roster-message">
						<p>DATABASE LINK FAILED.</p>
						<p>CHECK YOUR CONNECTION, THEN TRY AGAIN.</p>
						<button class="retry-button" type="button" onclick={loadPokedex}>RETRY LINK</button>
					</div>
				{:else}
					{#each filteredPokemon as pokemon (pokemon.id)}
						<button
							type="button"
							class="pokemon-entry"
							data-pokemon-name={pokemon.name}
							aria-current={pokemon.name === selectedName}
							aria-label={`${formatNumber(pokemon.id)} ${formatName(pokemon.name)}`}
							onclick={(event) => void selectPokemon(pokemon.name, event.currentTarget)}
							onkeydown={(event) => handleRosterKeydown(event, pokemon)}
						>
							<span class="entry-number">{formatNumber(pokemon.id)}</span>
							<span class="entry-name">{formatName(pokemon.name)}</span>
						</button>
					{:else}
						<p class="roster-message">NO SPECIMENS MATCH THIS SEARCH.</p>
					{/each}
				{/if}
			</div>

			<footer class="roster-footer">
				<p aria-live="polite">
					{rosterStatus === 'ready'
						? `${filteredPokemon.length} OF ${allPokemon.length} DISPLAYED`
						: rosterStatus === 'error'
							? 'NO INDEX DATA'
							: 'WAITING FOR DATABASE'}
				</p>
				<p>↑ ↓ / CLICK TO SELECT</p>
			</footer>
		</section>

		<section class="panel detail-panel" aria-labelledby="detail-title">
			<div class="panel-heading detail-heading">
				<div>
					<p class="eyebrow">SELECTED SPECIMEN</p>
					<h2 id="detail-title">DATA SCREEN</h2>
				</div>
				<p class="count-readout">{formatNumber(selectedRosterPokemon?.id)}</p>
			</div>

			<div class="detail-screen" aria-live="polite" aria-busy={detailStatus === 'loading'}>
				{#if detailStatus === 'loading'}
					<div class="screen-message">
						<span class="screen-cursor" aria-hidden="true">&gt;</span>
						<p>
							{selectedName
								? `RETRIEVING ${formatName(selectedName).toUpperCase()}`
								: 'SYNCHRONIZING DATABASE'}
						</p>
					</div>
				{:else if detailStatus === 'error'}
					<div class="detail-error">
						<p>SPECIMEN RECORD UNAVAILABLE.</p>
						<p>THE DATABASE LINK WAS INTERRUPTED.</p>
						{#if selectedName}
							<button
								class="retry-button"
								type="button"
								onclick={() => void selectPokemon(selectedName)}>RETRY RECORD</button
							>
						{/if}
					</div>
				{:else if selectedPokemon}
					<article class="pokemon-record" aria-label={`${formatName(selectedPokemon.name)} record`}>
						<div class="sprite-well">
							{#if getSprite(selectedPokemon)}
								<img
									src={getSprite(selectedPokemon)}
									alt={`${formatName(selectedPokemon.name)} pixel sprite`}
									onerror={(event) => selectedPokemon && useFallbackSprite(event, selectedPokemon)}
								/>
							{:else}
								<p>SPRITE UNAVAILABLE</p>
							{/if}
						</div>
						<div class="record-data">
							<p class="record-label">REGISTERED NAME</p>
							<h3 class="record-name">{formatName(selectedPokemon.name)}</h3>
							<p class="type-label">ELEMENTAL TYPE</p>
							<div class="type-list">
								{#each [...selectedPokemon.types].sort((a, b) => a.slot - b.slot) as pokemonType (pokemonType.slot)}
									<span class="type-badge" data-type={pokemonType.type.name}>
										{pokemonType.type.name}
									</span>
								{/each}
							</div>
						</div>
					</article>
				{/if}
			</div>
		</section>
	</div>

	<footer class="terminal-footer">
		<p>POKÉAPI DATA LINK</p>
		<p>SELECT A SPECIMEN TO VIEW ITS RECORD</p>
	</footer>
</main>

<noscript>
	<p class="noscript-message">THIS POKÉDEX REQUIRES JAVASCRIPT TO CONTACT THE DATABASE.</p>
</noscript>
