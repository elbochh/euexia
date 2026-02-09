import { desertTheme } from './desert';
import { jungleTheme } from './jungle';
import { cityTheme } from './city';

export const themes: Record<string, typeof desertTheme> = {
  desert: desertTheme,
  jungle: jungleTheme,
  city: cityTheme,
};

export function getTheme(name: string) {
  return themes[name] || themes.desert;
}

export type GameTheme = typeof desertTheme;

