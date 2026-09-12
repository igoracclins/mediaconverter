import type { MediaCategory } from '@shared/types';

export const CATEGORY_ORDER: MediaCategory[] = ['video', 'audio', 'image'];

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  video: 'Vídeos',
  audio: 'Áudios',
  image: 'Imagens',
};

export const CATEGORY_SINGULAR: Record<MediaCategory, string> = {
  video: 'vídeo',
  audio: 'áudio',
  image: 'imagem',
};

export const CATEGORY_PLURAL: Record<MediaCategory, string> = {
  video: 'vídeos',
  audio: 'áudios',
  image: 'imagens',
};

export interface GroupEntry<T> {
  item: T;
  index: number;
}

export interface CategoryGroup<T> {
  category: MediaCategory;
  entries: GroupEntry<T>[];
}

export function groupByCategory<T extends { category: MediaCategory }>(
  items: readonly T[],
): CategoryGroup<T>[] {
  return CATEGORY_ORDER.map((category) => {
    const entries: GroupEntry<T>[] = [];
    items.forEach((item, index) => {
      if (item.category === category) entries.push({ item, index });
    });
    return { category, entries };
  }).filter((group) => group.entries.length > 0);
}

export function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'arquivo' : 'arquivos'}`;
}