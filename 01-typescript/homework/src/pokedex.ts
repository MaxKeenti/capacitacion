export const POKE_API_BASE_URL = "https://pokeapi.co/api/v2";

export enum PokeApiResource {
  Pokemon = "pokemon",
  PokemonSpecies = "pokemon-species",
}

export interface NamedApiResource {
  name: string;
  url: string;
}

export interface ApiListResponse<T extends NamedApiResource> {
  count: number;
  results: T[];
}

export interface PokemonRosterEntry extends NamedApiResource {
  id: number;
}

export interface PokemonTypeEntry {
  slot: number;
  type: NamedApiResource;
}

interface SpriteSet {
  front_default: string | null;
}

export interface PokemonSprites extends SpriteSet {
  other?: {
    "official-artwork"?: SpriteSet;
  };
  versions?: {
    "generation-v"?: {
      "black-white"?: SpriteSet;
    };
  };
}

export interface PokemonRecord {
  id: number;
  name: string;
  sprites: PokemonSprites;
  types: PokemonTypeEntry[];
}

export function buildApiUrl(
  resource: PokeApiResource,
  identifier?: string | number,
  query?: Record<string, string | number>,
): string {
  const url = new URL(`${POKE_API_BASE_URL}/${resource}/`);

  if (identifier !== undefined) {
    url.pathname += `${encodeURIComponent(String(identifier))}/`;
  }

  Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

export function getIdFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

export function formatNumber(id: number): string {
  return id ? `#${String(id).padStart(4, "0")}` : "#----";
}

export function formatName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function toRosterEntries(resources: NamedApiResource[]): PokemonRosterEntry[] {
  return resources.map((pokemon) => ({
    ...pokemon,
    id: getIdFromUrl(pokemon.url),
  }));
}

export function filterRoster(entries: PokemonRosterEntry[], query: string): PokemonRosterEntry[] {
  const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");

  return entries.filter((pokemon) => {
    const formattedName = formatName(pokemon.name).toLowerCase();
    return (
      pokemon.name.includes(normalizedQuery) ||
      formattedName.includes(normalizedQuery) ||
      String(pokemon.id).startsWith(normalizedQuery)
    );
  });
}

export function getSprite(pokemon: PokemonRecord): string {
  const blackWhiteSprite = pokemon.sprites.versions?.["generation-v"]?.["black-white"]?.front_default;
  return blackWhiteSprite || pokemon.sprites.front_default || pokemon.sprites.other?.["official-artwork"]?.front_default || "";
}
