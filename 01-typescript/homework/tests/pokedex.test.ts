import { describe, expect, test } from "bun:test";

import {
  buildApiUrl,
  filterRoster,
  formatName,
  formatNumber,
  getIdFromUrl,
  getSprite,
  PokeApiResource,
  toRosterEntries,
  type PokemonRecord,
} from "../src/pokedex.ts";

describe("Pokédex data helpers", () => {
  test("builds a typed API URL for a named Pokémon", () => {
    const url = new URL(buildApiUrl(PokeApiResource.Pokemon, "mr-mime"));

    expect(url.pathname).toBe("/api/v2/pokemon/mr-mime/");
  });

  test("extracts, formats, and preserves canonical Pokédex numbers", () => {
    expect(getIdFromUrl("https://pokeapi.co/api/v2/pokemon-species/25/")).toBe(25);
    expect(formatNumber(25)).toBe("#0025");
  });

  test("formats API slugs into readable names", () => {
    expect(formatName("mr-mime")).toBe("Mr Mime");
  });

  test("filters the roster by name or Pokédex number", () => {
    const roster = toRosterEntries([
      { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon-species/1/" },
      { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
    ]);

    expect(filterRoster(roster, "pika").map(({ name }) => name)).toEqual(["pikachu"]);
    expect(filterRoster(roster, "#25").map(({ name }) => name)).toEqual(["pikachu"]);
  });

  test("prefers the era-appropriate pixel sprite and falls back safely", () => {
    const record: PokemonRecord = {
      id: 1,
      name: "bulbasaur",
      types: [],
      sprites: {
        front_default: "front.png",
        other: { "official-artwork": { front_default: "artwork.png" } },
        versions: { "generation-v": { "black-white": { front_default: "pixel.png" } } },
      },
    };

    expect(getSprite(record)).toBe("pixel.png");
    record.sprites.versions = undefined;
    expect(getSprite(record)).toBe("front.png");
  });
});
