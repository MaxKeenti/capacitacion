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

	function typeColorClass(type: string) {
		const colors: Record<string, string> = {
			normal: 'text-[#e4e4e4]',
			fire: 'text-[#ffaf00]',
			water: 'text-[#55aaff]',
			electric: 'text-[#ffff00]',
			grass: 'text-phosphor',
			ice: 'text-[#55ffff]',
			fighting: 'text-danger',
			poison: 'text-[#ff55ff]',
			ground: 'text-[#d7af5f]',
			flying: 'text-[#afafff]',
			psychic: 'text-[#ff55af]',
			bug: 'text-[#afd700]',
			rock: 'text-[#d7af5f]',
			ghost: 'text-[#af87ff]',
			dragon: 'text-[#8787ff]',
			dark: 'text-[#c6c6c6]',
			steel: 'text-muted',
			fairy: 'text-[#ff87d7]'
		};

		return colors[type] ?? 'text-text';
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

<main
	class="mx-auto my-2 w-[calc(100%-1rem)] max-w-295 border border-line bg-ink/90 shadow-[6px_6px_0_rgba(0,0,0,0.55),inset_0_0_0_1px_#000] min-[431px]:my-9 min-[431px]:w-[calc(100%-2rem)] min-[431px]:shadow-[12px_12px_0_rgba(0,0,0,0.55),inset_0_0_0_1px_#000]"
	aria-labelledby="page-title"
>
	<header
		class="flex items-center justify-between gap-4 border-b border-line px-3 py-4 min-[431px]:px-5"
	>
		<div class="flex items-center gap-3.5">
			<span
				class="relative inline-block size-6.5 rounded-full border-[3px] border-text bg-[linear-gradient(to_bottom,#ff5555_0_44%,#eeeeee_44%_56%,#080808_56%)] shadow-[0_0_0_2px_#080808,0_0_0_3px_#eeeeee]"
				aria-hidden="true"
			>
				<i
					class="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-text bg-ink"
				></i>
			</span>
			<h1
				class="font-heading text-[clamp(0.9rem,2.3vw,1.2rem)] font-normal tracking-[0.08em] text-acid"
				id="page-title"
			>
				POKÉDEX
			</h1>
		</div>
		<p
			class="hidden items-center gap-2 text-[0.95rem] whitespace-nowrap text-phosphor min-[761px]:flex"
		>
			<span
				class="size-2 rounded-full bg-phosphor shadow-[0_0_9px_var(--color-phosphor)]"
				aria-hidden="true"
			></span>
			LINK ESTABLISHED
		</p>
	</header>

	<section
		class="flex min-h-9.5 items-center justify-between gap-4 border-b border-line bg-panel-raised px-3 py-2 text-[0.8rem] text-muted min-[431px]:px-5 min-[761px]:text-[0.95rem]"
		aria-label="Application information"
	>
		<p>NATIONAL INDEX // TRAINER DATABASE</p>
		<p class="hidden text-acid min-[761px]:block">
			V2.0 <span aria-hidden="true">//</span> ONLINE
		</p>
	</section>

	<div class="grid min-h-148 min-[761px]:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)]">
		<section
			class="flex min-w-0 flex-col border-b border-line bg-black/20 px-3 py-4.5 min-[431px]:px-4.5 min-[761px]:border-r min-[761px]:border-b-0"
			aria-labelledby="roster-title"
		>
			<div
				class="flex items-center justify-between gap-4 border-b-3 border-double border-line-bright pb-4"
			>
				<div>
					<p class="mb-2 text-[0.95rem] text-acid">DATABASE</p>
					<h2 class="font-heading text-[0.65rem] leading-[1.6] font-normal" id="roster-title">
						POKÉMON ROSTER
					</h2>
				</div>
				<p class="text-right text-[0.95rem] text-muted" aria-live="polite">
					{rosterStatus === 'ready'
						? `${allPokemon.length} FOUND`
						: rosterStatus === 'error'
							? 'OFFLINE'
							: 'CONNECTING'}
				</p>
			</div>

			<label class="my-4 grid gap-2 text-muted" for="pokemon-search">
				<span class="text-[0.95rem]">SEARCH INDEX</span>
				<input
					class="w-full rounded-none border border-line bg-ink px-2.5 py-2 text-acid shadow-[inset_3px_3px_0_rgba(0,0,0,0.7)] placeholder:text-[#707070] focus:outline-3 focus:outline-offset-2 focus:outline-acid disabled:cursor-wait"
					id="pokemon-search"
					type="search"
					placeholder="NAME OR NUMBER"
					autocomplete="off"
					disabled={rosterStatus !== 'ready'}
					bind:value={query}
				/>
			</label>

			<div
				class="max-h-64 min-h-72 flex-none scrollbar-thin [scrollbar-color:var(--color-acid)_var(--color-panel-raised)] overflow-y-auto border border-line bg-[#050505] min-[761px]:max-h-108 min-[761px]:flex-1 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-panel-raised [&::-webkit-scrollbar-thumb]:bg-acid [&::-webkit-scrollbar-track]:bg-panel-raised"
				aria-label="All Pokémon"
				aria-busy={rosterStatus === 'loading'}
			>
				{#if rosterStatus === 'loading'}
					<p class="p-4 text-muted">
						RETRIEVING NATIONAL INDEX<span
							class="inline-block w-6 animate-[dots_1.2s_steps(4,end)_infinite] overflow-hidden align-bottom"
							aria-hidden="true">...</span
						>
					</p>
				{:else if rosterStatus === 'error'}
					<div class="p-4 text-center text-danger">
						<p>DATABASE LINK FAILED.</p>
						<p class="mt-3 text-text">CHECK YOUR CONNECTION, THEN TRY AGAIN.</p>
						<button
							class="mt-4 cursor-pointer border border-acid bg-transparent px-3 py-1.5 text-acid hover:bg-acid hover:text-ink focus:outline-3 focus:outline-offset-2 focus:outline-acid"
							type="button"
							onclick={loadPokedex}>RETRY LINK</button
						>
					</div>
				{:else}
					{#each filteredPokemon as pokemon (pokemon.id)}
						<button
							type="button"
							class={[
								'grid min-h-9.5 w-full cursor-pointer grid-cols-[4.1rem_1fr_auto] items-center border-0 border-b border-[#2d2d2d] px-2 py-1.5 text-left focus:outline-3 focus:outline-offset-2 focus:outline-acid',
								pokemon.name === selectedName
									? "bg-acid text-ink after:text-[0.7rem] after:content-['◀']"
									: 'bg-transparent text-text hover:bg-[#262626] hover:text-acid'
							]}
							data-pokemon-name={pokemon.name}
							aria-current={pokemon.name === selectedName}
							aria-label={`${formatNumber(pokemon.id)} ${formatName(pokemon.name)}`}
							onclick={(event) => void selectPokemon(pokemon.name, event.currentTarget)}
							onkeydown={(event) => handleRosterKeydown(event, pokemon)}
						>
							<span class={pokemon.name === selectedName ? 'text-ink' : 'text-muted'}>
								{formatNumber(pokemon.id)}
							</span>
							<span class="overflow-hidden text-ellipsis whitespace-nowrap">
								{formatName(pokemon.name)}
							</span>
						</button>
					{:else}
						<p class="p-4 text-muted">NO SPECIMENS MATCH THIS SEARCH.</p>
					{/each}
				{/if}
			</div>

			<footer class="flex items-center justify-between gap-4 pt-3 text-[0.95rem] text-muted">
				<p aria-live="polite">
					{rosterStatus === 'ready'
						? `${filteredPokemon.length} OF ${allPokemon.length} DISPLAYED`
						: rosterStatus === 'error'
							? 'NO INDEX DATA'
							: 'WAITING FOR DATABASE'}
				</p>
				<p class="hidden text-right min-[431px]:block">↑ ↓ / CLICK TO SELECT</p>
			</footer>
		</section>

		<section
			class="flex min-w-0 flex-col bg-[linear-gradient(135deg,rgba(228,242,33,0.045),transparent_43%)] px-3 py-4.5 min-[431px]:px-4.5"
			aria-labelledby="detail-title"
		>
			<div
				class="flex items-center justify-between gap-4 border-b-3 border-double border-line-bright pb-4"
			>
				<div>
					<p class="mb-2 text-[0.95rem] text-acid">SELECTED SPECIMEN</p>
					<h2 class="font-heading text-[0.65rem] leading-[1.6] font-normal" id="detail-title">
						DATA SCREEN
					</h2>
				</div>
				<p class="text-right text-[0.95rem] text-muted">
					{formatNumber(selectedRosterPokemon?.id)}
				</p>
			</div>

			<div
				class="relative mt-4 grid min-h-88 flex-1 place-items-center overflow-hidden border-6 border-double border-line-bright bg-[repeating-linear-gradient(0deg,rgba(85,255,85,0.04)_0,rgba(85,255,85,0.04)_1px,transparent_1px,transparent_4px),#0a100a] p-5 shadow-[inset_0_0_50px_rgba(85,255,85,0.08)] before:pointer-events-none before:absolute before:top-3 before:left-3 before:text-[0.9rem] before:text-[rgba(228,242,33,0.3)] before:content-['[_RECORD_]'] after:pointer-events-none after:absolute after:right-3 after:bottom-2.5 after:text-[0.9rem] after:tracking-[0.25rem] after:text-[rgba(228,242,33,0.3)] after:content-['◼_◼_◼'] min-[761px]:min-h-112"
				aria-live="polite"
				aria-busy={detailStatus === 'loading'}
			>
				{#if detailStatus === 'loading'}
					<div class="flex items-center gap-2 text-phosphor">
						<span class="animate-[blink_0.9s_steps(2,start)_infinite]" aria-hidden="true"
							>&gt;</span
						>
						<p>
							{selectedName
								? `RETRIEVING ${formatName(selectedName).toUpperCase()}`
								: 'SYNCHRONIZING DATABASE'}
						</p>
					</div>
				{:else if detailStatus === 'error'}
					<div class="max-w-96 text-center text-danger">
						<p>SPECIMEN RECORD UNAVAILABLE.</p>
						<p class="mt-3 text-text">THE DATABASE LINK WAS INTERRUPTED.</p>
						{#if selectedName}
							<button
								class="mt-4 cursor-pointer border border-acid bg-transparent px-3 py-1.5 text-acid hover:bg-acid hover:text-ink focus:outline-3 focus:outline-offset-2 focus:outline-acid"
								type="button"
								onclick={() => void selectPokemon(selectedName)}>RETRY RECORD</button
							>
						{/if}
					</div>
				{:else if selectedPokemon}
					<article
						class="relative z-1 grid w-full max-w-xl grid-cols-1 items-center gap-4 min-[431px]:grid-cols-[minmax(9rem,0.85fr)_minmax(12rem,1.15fr)] min-[431px]:gap-[clamp(1rem,4vw,2.5rem)]"
						aria-label={`${formatName(selectedPokemon.name)} record`}
					>
						<div
							class="grid min-h-36 place-items-center border border-[rgba(228,242,33,0.55)] bg-[radial-gradient(circle,rgba(85,255,85,0.12)_0,transparent_69%)] min-[431px]:min-h-50"
						>
							{#if getSprite(selectedPokemon)}
								<img
									class="h-auto max-h-36 w-36 object-contain drop-shadow-[4px_4px_0_rgba(0,0,0,0.7)] [image-rendering:pixelated] min-[431px]:max-h-52 min-[431px]:w-full min-[431px]:max-w-48"
									src={getSprite(selectedPokemon)}
									alt={`${formatName(selectedPokemon.name)} pixel sprite`}
									onerror={(event) => selectedPokemon && useFallbackSprite(event, selectedPokemon)}
								/>
							{:else}
								<p>SPRITE UNAVAILABLE</p>
							{/if}
						</div>
						<div class="min-w-0">
							<p class="mb-2 text-[0.95rem] text-muted">REGISTERED NAME</p>
							<h3
								class="mb-3 font-heading text-[clamp(0.8rem,2vw,1.25rem)] leading-[1.7] font-normal wrap-break-word text-acid min-[431px]:mb-5"
							>
								{formatName(selectedPokemon.name)}
							</h3>
							<p class="mb-2.5 text-muted">ELEMENTAL TYPE</p>
							<div class="flex flex-wrap gap-2">
								{#each [...selectedPokemon.types].sort((a, b) => a.slot - b.slot) as pokemonType (pokemonType.slot)}
									<span
										class={[
											'border border-current px-2 py-1 text-base leading-none uppercase',
											typeColorClass(pokemonType.type.name)
										]}
									>
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

	<footer
		class="flex min-h-10 items-center justify-between gap-4 border-t border-line bg-panel-raised px-3 py-2 text-[0.9rem] text-muted min-[431px]:px-5"
	>
		<p>POKÉAPI DATA LINK</p>
		<p class="hidden min-[431px]:block">SELECT A SPECIMEN TO VIEW ITS RECORD</p>
	</footer>
</main>

<noscript>
	<p class="m-4 font-mono text-acid">THIS POKÉDEX REQUIRES JAVASCRIPT TO CONTACT THE DATABASE.</p>
</noscript>
