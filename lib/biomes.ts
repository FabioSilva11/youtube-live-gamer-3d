export const BIOMES = [
  {
    id: 'fantasy',
    name: 'Ilha Fantasia',
    type: 'EXPLORAÇÃO E ENCONTROS',
    image: '/images/fantasy-real.png',
    description: 'Uma ilha flutuante com natureza, cachoeiras e personagens que exploram o cenário e se encontram.',
    tags: ['Exploração livre', 'Encontros entre personagens'],
    systems: ['exploration', 'social'],
  },
  {
    id: 'minecraft',
    name: 'Mundo Minecraft',
    type: 'CONSTRUÇÃO COOPERATIVA',
    image: '/images/minecraft-real.png',
    description: 'Sua comunidade trabalha em equipe: constrói cada obra e seus andaimes, ajuda nos outros canteiros e desmonta tudo para recomeçar.',
    tags: ['Obras em equipe', 'Ciclos de construção'],
    systems: ['voxel', 'cooperative-building'],
  },
] as const;

export type BiomeId = typeof BIOMES[number]['id'];
export type BiomeDefinition = typeof BIOMES[number];
export function isBiomeId(value: unknown): value is BiomeId {
  return typeof value === 'string' && BIOMES.some(biome => biome.id === value);
}
export function biomeDefinition(id: BiomeId) {
  return BIOMES.find(biome => biome.id === id)!;
}
