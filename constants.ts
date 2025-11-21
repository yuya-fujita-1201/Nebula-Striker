
// Dynamic canvas size will be handled in the component, 
// but we keep these as fallbacks or reference logic if needed.
export const PLAYER_SPEED = 7; 
export const PLAYER_SIZE = 40;
export const PLAYER_INVULNERABILITY_TIME = 2000; // ms

export const BULLET_SPEED = 14;

export const BASE_ENEMY_SPAWN_RATE = 1000; // ms
export const BASE_ENEMY_SPEED = 4;

// Stage Settings
export const STAGE_DURATION = 9000; // Tripled duration
export const SCROLL_SPEED = 2;

// Max Upgrade Levels
export const MAX_BIT_LEVEL = 6;
export const MAX_SHIELD_LEVEL = 3;

// Missile Config
export const MISSILE_LIFETIME = 2500; // ms before enemy missiles explode

// Weapon Stats
export const WEAPON_STATS = {
  STANDARD: { damage: 1.5, speed: 16, interval: 150, width: 15, height: 4, color: '#ffff00' },
  SPREAD: { damage: 1.0, speed: 16, interval: 180, width: 12, height: 4, color: '#ff3333' }, // 5-Way
  LASER: { damage: 2.0, speed: 25, interval: 140, width: 40, height: 6, color: '#00ffaa' }, // Piercing
  PLASMA: { damage: 15.0, speed: 9, interval: 550, width: 28, height: 28, color: '#d000ff' }, // High dmg, slow
  HOMING: { damage: 1.2, speed: 12, interval: 220, width: 12, height: 6, color: '#0088ff' } // Tracking
};

export const COLORS = {
  player: '#00f0ff', // Cyan
  playerBullet: '#ffea00', // Yellow
  
  // Enemies
  enemyScout: '#ff0055', // Red/Pink
  enemyFighter: '#9d00ff', // Purple
  enemyTank: '#ff5500', // Orange
  enemyTurret: '#aaaaaa', // Grey
  enemyBoss: '#ffffff', // White/Red
  enemyBullet: '#ff0000', // Red
  
  particle: '#ffffff',
  
  // Obstacles
  obsRock: '#8b5a2b', // Brown
  obsWall: '#444444', // Dark Grey
  
  // Environment
  ground: '#2a2a2a',
  
  // Items
  itemSpread: '#ff3333',  // Red
  itemLaser: '#00ffaa',   // Green
  itemPlasma: '#d000ff',  // Purple
  itemHoming: '#0088ff',  // Blue
  itemBit: '#33ff33',     // Lime
  itemShield: '#3333ff',  // Blue
  itemHealth: '#ff33ff'   // Pink
};
