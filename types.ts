
export interface Bullet {
  id: string;
  text: string;
  note: string;
  children: Bullet[];
  isCollapsed: boolean;
}
