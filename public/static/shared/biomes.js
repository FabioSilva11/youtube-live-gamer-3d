export const BIOME_REGISTRY = Object.freeze({
  fantasy: Object.freeze({
    id: 'fantasy',
    name: 'Ilha Fantasia',
    characterBehavior: 'social',
    systems: Object.freeze(['exploration', 'social']),
    async create({ scene }) {
      const { createFantasyBiome } = await import('/static/biomes/fantasy/FantasyBiome.js');
      return createFantasyBiome(scene);
    },
  }),
  minecraft: Object.freeze({
    id: 'minecraft',
    name: 'Mundo Minecraft',
    characterBehavior: 'builder',
    systems: Object.freeze(['voxel', 'cooperative-building']),
    async create() {
      const { MinecraftBiome } = await import('/static/biomes/minecraft/MinecraftBiome.js');
      return new MinecraftBiome();
    },
  }),
});
export const BIOMES = Object.freeze(Object.keys(BIOME_REGISTRY));
export const normaliseBiome = value => Object.hasOwn(BIOME_REGISTRY, value) ? value : 'fantasy';
export async function createBiomeRuntime(value, context = {}) {
  const definition = BIOME_REGISTRY[normaliseBiome(value)];
  const runtime = await definition.create(context);
  runtime.definition = definition;
  return runtime;
}
