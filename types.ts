
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  BRIEFING = 'BRIEFING',
  BOSS_WARNING = 'BOSS_WARNING',
  STAGE_CLEAR = 'STAGE_CLEAR'
}

export enum StageType {
  DEEP_SPACE = 'Deep Space',
  ASTEROID_FIELD = 'Asteroid Field',
  ENEMY_FLEET = 'Enemy Fleet',
  PLANET_SURFACE = 'Planet Surface',
  SPACE_FORTRESS = 'Space Fortress'
}

export type WeaponType = 'STANDARD' | 'SPREAD' | 'LASER' | 'PLASMA' | 'HOMING';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2D;
  velocity: Vector2D;
  width: number;
  height: number;
  color: string;
  active: boolean;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  invulnerableUntil: number;
  // Upgrades
  weaponType: WeaponType;
  bits: number; // 0 to 5
  shield: number; // 0 to 3
}

export interface Bullet extends Entity {
  damage: number;
  isEnemy: boolean;
  type: WeaponType;
  piercing?: boolean;
  homingTargetId?: string; // ID of the target enemy
  createdAt: number; // For lifetime tracking
}

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  type: 'scout' | 'fighter' | 'tank' | 'boss' | 'turret';
  scoreValue: number;
  attackTimer?: number; // For boss patterns
}

export interface Obstacle extends Entity {
  type: 'rock' | 'wall';
  hp: number;
  indestructible: boolean;
}

export type ItemType = 'weapon_spread' | 'weapon_laser' | 'weapon_plasma' | 'weapon_homing' | 'bit' | 'shield' | 'health';

export interface Item extends Entity {
  type: ItemType;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  size: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

export interface MissionData {
  title: string;
  description: string;
  target: string;
}
