export type CharacterId =
  | 'character-a'
  | 'character-b'
  | 'character-c'
  | 'character-d'
  | 'character-e'
  | 'character-f';

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  price: number; // coins
  tier: 'easy' | 'medium' | 'hard';
}

export const DEFAULT_CHARACTER_ID: CharacterId = 'character-a';

export const CHARACTERS: CharacterConfig[] = [
  { id: 'character-a', name: 'Explorer', price: 0, tier: 'easy' },
  { id: 'character-b', name: 'Medic', price: 15, tier: 'easy' },
  { id: 'character-c', name: 'Ranger', price: 30, tier: 'medium' },
  { id: 'character-d', name: 'Cyber Scout', price: 75, tier: 'medium' },
  { id: 'character-e', name: 'Galaxy Hero', price: 150, tier: 'hard' },
  { id: 'character-f', name: 'Legend', price: 300, tier: 'hard' },
];

export function getCharacterSpriteSrc(id: CharacterId): string {
  // Assets are under /public/kenney_blocky-characters_20/Previews/character-?.png
  return `/kenney_blocky-characters_20/Previews/${id}.png`;
}

