
export interface Bullet {
  id: string;
  text: string;
  children: Bullet[];
  isCollapsed: boolean;
  isReadOnly?: boolean;
  isFavorite?: boolean;
  originalId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface FlatBullet {
  id: string;
  text: string;
  path: string[];
  createdAt?: number;
  updatedAt?: number;
}

export interface Settings {
  mainColor: string;
  fileName: string;
  fontFamily: string;
  fontSize: number;
}

// A type representing the core data of a bullet, excluding UI state like 'isCollapsed' or 'isReadOnly'.
// This ensures that only essential data is persisted.
export type CoreBullet = {
  id: string;
  text: string;
  children: CoreBullet[];
  isFavorite?: boolean;
  originalId?: string;
  createdAt?: number;
  updatedAt?: number;
};