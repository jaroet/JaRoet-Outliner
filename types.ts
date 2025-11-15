export interface Bullet {
  id: string;
  text: string;
  children: Bullet[];
  isCollapsed: boolean;
  isReadOnly?: boolean;
  originalId?: string;
}

export interface FlatBullet {
  id: string;
  text: string;
  path: string[];
}

export interface Settings {
  mainColor: string;
  fileName: string;
  fontFamily: string;
  fontSize: number;
}
