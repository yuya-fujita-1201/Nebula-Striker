import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, Player, Bullet, Enemy, Particle, Item, ItemType, StageType, Obstacle, WeaponType, Entity } from '../types';
import {
  COLORS,
  PLAYER_SPEED,
  PLAYER_SIZE,
  BASE_ENEMY_SPAWN_RATE,
  BASE_ENEMY_SPEED,
  PLAYER_INVULNERABILITY_TIME,
  STAGE_DURATION,
  SCROLL_SPEED,
  MAX_BIT_LEVEL,
  MAX_SHIELD_LEVEL,
  WEAPON_STATS,
  MISSILE_LIFETIME
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  lives: number;
  setLives: React.Dispatch<React.SetStateAction<number>>;
  stageType: StageType;
  stageIndex: number;
  onBossDefeated: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  score,
  setScore,
  setLives,
  stageType,
  stageIndex,
  onBossDefeated
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const lastFireTimeRef = useRef<number>(0);
  const bossActiveRef = useRef<boolean>(false);
  
  // Stage Progress
  const stageProgressRef = useRef<number>(0);
  const obstacleSpawnTimerRef = useRef<number>(0);

  // Screen Dimensions (mutable to handle resize)
  const screenRef = useRef({ w: 800, h: 600 });

  // Mutable Game State
  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: 100, y: 300 },
    velocity: { x: 0, y: 0 },
    width: PLAYER_SIZE,
    height: PLAYER_SIZE / 2,
    color: COLORS.player,
    active: true,
    hp: 3,
    maxHp: 3,
    invulnerableUntil: 0,
    weaponType: 'STANDARD',
    bits: 0,
    shield: 0
  });

  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  
  // Input State
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const touchRef = useRef<{ active: boolean; x: number; y: number } | null>(null);

  // --- Helpers ---

  const spawnItem = (x: number, y: number, guaranteed: boolean = false) => {
    // 50% chance to drop item normally, or guaranteed
    if (!guaranteed && Math.random() > 0.5) return;

    const rand = Math.random();
    let type: ItemType = 'weapon_spread';
    let color = COLORS.itemSpread;

    // 0.0 - 0.3: Health/Shield/Bit
    // 0.3 - 1.0: Weapons
    if (rand < 0.10) { type = 'health'; color = COLORS.itemHealth; }
    else if (rand < 0.20) { type = 'shield'; color = COLORS.itemShield; }
    else if (rand < 0.30) { type = 'bit'; color = COLORS.itemBit; }
    else if (rand < 0.50) { type = 'weapon_spread'; color = COLORS.itemSpread; }
    else if (rand < 0.70) { type = 'weapon_laser'; color = COLORS.itemLaser; }
    else if (rand < 0.85) { type = 'weapon_homing'; color = COLORS.itemHoming; }
    else { type = 'weapon_plasma'; color = COLORS.itemPlasma; }
    
    itemsRef.current.push({
      id: Math.random().toString(),
      pos: { x, y },
      velocity: { x: -1.5, y: Math.sin(Date.now()) * 0.5 },
      width: 24,
      height: 24,
      color: color,
      active: true,
      type
    });
  };

  const spawnBoss = () => {
    bossActiveRef.current = true;
    const { w, h } = screenRef.current;
    
    enemiesRef.current = []; // Clear other enemies
    obstaclesRef.current = []; // Clear obstacles
    
    const baseHp = 350;
    const hpPerStage = 500;
    const bossHp = baseHp + (stageIndex * hpPerStage);

    const boss: Enemy = {
      id: 'boss-' + Date.now(),
      pos: { x: w + 100, y: h / 2 - 75 },
      velocity: { x: -2, y: 0 },
      width: 180,
      height: 180,
      color: COLORS.enemyBoss,
      active: true,
      hp: bossHp,
      maxHp: bossHp,
      type: 'boss',
      scoreValue: 10000 + (stageIndex * 5000),
      attackTimer: 0
    };
    enemiesRef.current.push(boss);
  };

  const spawnObstacle = () => {
    const { w, h } = screenRef.current;
    
    if (stageType === StageType.ASTEROID_FIELD) {
        const size = Math.random() * 40 + 30;
        obstaclesRef.current.push({
            id: 'rock-' + Date.now(),
            pos: { x: w + 50, y: Math.random() * (h - size) },
            velocity: { x: -(Math.random() * 3 + 2), y: (Math.random() - 0.5) * 2 },
            width: size,
            height: size,
            color: COLORS.obsRock,
            active: true,
            type: 'rock',
            hp: 20,
            indestructible: false
        });
    } else if (stageType === StageType.SPACE_FORTRESS) {
        const isTop = Math.random() > 0.5;
        const height = Math.random() * 200 + 50;
        obstaclesRef.current.push({
            id: 'wall-' + Date.now(),
            pos: { x: w + 50, y: isTop ? 0 : h - height },
            velocity: { x: -SCROLL_SPEED, y: 0 },
            width: 60,
            height: height,
            color: COLORS.obsWall,
            active: true,
            type: 'wall',
            hp: 999,
            indestructible: true
        });
    }
  };

  const spawnEnemy = () => {
    if (bossActiveRef.current) return;

    const { w, h } = screenRef.current;
    
    let spawnRateMod = 1.0;
    if (stageType === StageType.ENEMY_FLEET) spawnRateMod = 0.4;
    if (stageType === StageType.ASTEROID_FIELD) spawnRateMod = 1.5;
    if (stageType === StageType.SPACE_FORTRESS) spawnRateMod = 1.2;
    spawnRateMod = Math.max(0.15, spawnRateMod - (stageIndex * 0.12));

    if (stageType === StageType.PLANET_SURFACE && Math.random() > 0.6) {
        const groundHeight = 60;
        const enemy: Enemy = {
            id: 'turret-' + Math.random(),
            pos: { x: w + 50, y: h - groundHeight - 40 },
            velocity: { x: -SCROLL_SPEED, y: 0 },
            width: 40,
            height: 40,
            color: COLORS.enemyTurret,
            active: true,
            hp: 5 + stageIndex,
            maxHp: 5 + stageIndex,
            type: 'turret',
            scoreValue: 200
        };
        enemiesRef.current.push(enemy);
        return;
    }

    const typeRoll = Math.random();
    let type: Enemy['type'] = 'scout';
    let hp = 1 + Math.floor(stageIndex / 2);
    let speed = BASE_ENEMY_SPEED + (stageIndex * 0.5);
    let scoreVal = 100;
    let height = 30;
    let color = COLORS.enemyScout;
    let width = 40;

    if (typeRoll > 0.85) {
      type = 'tank';
      hp = 8 + stageIndex;
      speed = (BASE_ENEMY_SPEED * 0.5) + (stageIndex * 0.2);
      scoreVal = 300;
      height = 60;
      width = 60;
      color = COLORS.enemyTank;
    } else if (typeRoll > 0.6) {
      type = 'fighter';
      hp = 3 + Math.floor(stageIndex / 2);
      speed = (BASE_ENEMY_SPEED * 1.3) + (stageIndex * 0.5);
      scoreVal = 150;
      height = 30;
      color = COLORS.enemyFighter;
    }

    const enemy: Enemy = {
      id: Math.random().toString(36).substr(2, 9),
      pos: { x: w + 50, y: Math.random() * (h - 100) + 50 },
      velocity: { x: -speed, y: type === 'fighter' ? (Math.random() - 0.5) * 3 : 0 },
      width,
      height,
      color: color,
      active: true,
      hp,
      maxHp: hp,
      type,
      scoreValue: scoreVal
    };
    enemiesRef.current.push(enemy);
  };

  const createExplosion = (x: number, y: number, color: string, count: number = 10, sizeMod: number = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        width: 0,
        height: 0,
        color: color,
        active: true,
        life: 1.0,
        maxLife: 1.0,
        size: (Math.random() * 4 + 1) * sizeMod
      });
    }
  };

  const resetGame = useCallback(() => {
    const { h } = screenRef.current;
    playerRef.current = {
      ...playerRef.current,
      pos: { x: 100, y: h / 2 },
      hp: 3,
      maxHp: 3,
      invulnerableUntil: 0,
      active: true,
      weaponType: 'STANDARD',
      bits: 0,
      shield: 0
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    itemsRef.current = [];
    obstaclesRef.current = [];
    bossActiveRef.current = false;
    stageProgressRef.current = 0;
    setLives(3);
    setScore(0);
  }, [setLives, setScore]);

  const setupStage = useCallback(() => {
      const { h } = screenRef.current;
      playerRef.current.pos = { x: 100, y: h / 2 };
      playerRef.current.invulnerableUntil = Date.now() + 1000;
      bulletsRef.current = [];
      enemiesRef.current = [];
      obstaclesRef.current = [];
      particlesRef.current = [];
      itemsRef.current = [];
      bossActiveRef.current = false;
      stageProgressRef.current = 0;
  }, []);

  // --- Shoot Logic ---
  const spawnBullet = (pos: {x: number, y: number}, angle: number, weaponType: WeaponType, fromBit: boolean = false, isEnemy: boolean = false, speedMod: number = 1) => {
      const stats = WEAPON_STATS[weaponType];
      
      let damage = stats.damage;
      const speed = stats.speed * speedMod;
      let width = stats.width;
      let height = stats.height;
      let color = isEnemy ? COLORS.enemyBullet : stats.color;
      
      if (isEnemy) {
          if (weaponType === 'LASER') color = '#ff00ff';
          else if (weaponType === 'PLASMA') color = '#ffaa00';
          // Make enemy standard bullets larger and rounder visibility
          else if (weaponType === 'STANDARD') {
              width = 12;
              height = 12;
          }
      }

      if (fromBit) damage *= 0.5; // Bits deal half damage

      bulletsRef.current.push({
          id: Math.random().toString(),
          pos: { x: pos.x, y: pos.y },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          width,
          height,
          color,
          active: true,
          damage,
          isEnemy,
          type: weaponType,
          piercing: weaponType === 'LASER',
          createdAt: Date.now()
      });
  };

  const firePlayerShots = () => {
      const player = playerRef.current;
      const stats = WEAPON_STATS[player.weaponType];
      
      // Enforce fire rate per weapon
      if (Date.now() - lastFireTimeRef.current < stats.interval) return;
      lastFireTimeRef.current = Date.now();

      let angles = [0];
      if (player.weaponType === 'SPREAD') {
          angles = [-0.4, -0.2, 0, 0.2, 0.4]; // 5-Way
      }

      // Player fires
      angles.forEach(angle => {
          const yOffset = player.weaponType === 'PLASMA' ? player.height / 2 - stats.height / 2 : player.height / 2 - 2;
          spawnBullet(
              { x: player.pos.x + player.width, y: player.pos.y + yOffset }, 
              angle, 
              player.weaponType
          );
      });

      // Bits fire same weapon
      if (player.bits > 0) {
          const bitSpacing = 40;
          
          for(let i=0; i < player.bits; i++) {
             // 0->Top, 1->Bottom, 2->Top(farther), 3->Bottom(farther)
             const pairIndex = Math.floor(i / 2);
             const isTop = i % 2 === 0;
             const yOffset = (pairIndex + 1) * bitSpacing * (isTop ? -1 : 1);

             // Position bit slightly behind player
             const bitPos = { 
                 x: player.pos.x - 10, 
                 y: player.pos.y + player.height/2 + yOffset 
             };
             
             angles.forEach(angle => {
                spawnBullet(bitPos, angle, player.weaponType, true);
             });
          }
      }
  };

  // --- Main Loop ---

  const update = (time: number) => {
    if (gameState !== GameState.PLAYING && gameState !== GameState.BOSS_WARNING) return;
    
    if (gameState === GameState.BOSS_WARNING) {
       if (time - lastTimeRef.current > 3000) {
         spawnBoss();
         setGameState(GameState.PLAYING);
       }
       draw();
       requestRef.current = requestAnimationFrame(() => update(Date.now()));
       return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    const { w, h } = screenRef.current;

    if (!bossActiveRef.current) {
        stageProgressRef.current += (SCROLL_SPEED * (deltaTime / 16));
        if (stageProgressRef.current >= STAGE_DURATION) {
            setGameState(GameState.BOSS_WARNING);
            return;
        }
    }

    // 1. Player Movement
    const player = playerRef.current;
    const speed = PLAYER_SPEED;
    
    if (keysRef.current['ArrowUp'] || keysRef.current['w']) player.pos.y -= speed;
    if (keysRef.current['ArrowDown'] || keysRef.current['s']) player.pos.y += speed;
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) player.pos.x -= speed;
    if (keysRef.current['ArrowRight'] || keysRef.current['d']) player.pos.x += speed;

    if (touchRef.current && touchRef.current.active) {
        const targetY = touchRef.current.y;
        const targetX = touchRef.current.x;
        const dy = targetY - player.pos.y;
        const dx = targetX - player.pos.x;
        player.pos.y += dy * 0.15;
        player.pos.x += dx * 0.15;
    }

    const groundLimit = stageType === StageType.PLANET_SURFACE ? h - 60 - player.height : h - player.height;
    player.pos.x = Math.max(0, Math.min(player.pos.x, w - player.width));
    player.pos.y = Math.max(0, Math.min(player.pos.y, groundLimit));

    // 2. Shooting
    if (keysRef.current[' '] || (touchRef.current?.active)) {
      firePlayerShots();
    }

    // 3. Update Bullets
    bulletsRef.current.forEach(b => {
      // Missile Expiration
      if (b.type === 'HOMING' && b.isEnemy && b.active) {
          if (Date.now() - b.createdAt > MISSILE_LIFETIME) {
              b.active = false;
              createExplosion(b.pos.x, b.pos.y, b.color, 8);
              return; // Skip remaining logic
          }
      }

      // Homing Logic
      if (b.type === 'HOMING') {
          let target: Entity | null = null;
          let minDist = 500;
          
          // If player bullet, find nearest enemy
          if (!b.isEnemy) {
            if (b.homingTargetId) {
                target = enemiesRef.current.find(e => e.id === b.homingTargetId) || null;
            }
            if (!target) {
                enemiesRef.current.forEach(e => {
                    const dist = Math.hypot(e.pos.x - b.pos.x, e.pos.y - b.pos.y);
                    if (dist < minDist && e.pos.x > b.pos.x) {
                        minDist = dist;
                        target = e;
                        b.homingTargetId = e.id;
                    }
                });
            }
          } 
          // If enemy bullet, find player
          else {
             const dist = Math.hypot(player.pos.x - b.pos.x, player.pos.y - b.pos.y);
             if (dist < minDist) {
                 target = player;
             }
          }
          
          if (target) {
              const angle = Math.atan2(target.pos.y - b.pos.y, target.pos.x - b.pos.x);
              // Steer
              const currentAngle = Math.atan2(b.velocity.y, b.velocity.x);
              let diff = angle - currentAngle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              
              const turnSpeed = 0.1; // Maneuverability
              const newAngle = currentAngle + Math.max(-turnSpeed, Math.min(turnSpeed, diff));
              const speed = Math.hypot(b.velocity.x, b.velocity.y);
              b.velocity.x = Math.cos(newAngle) * speed;
              b.velocity.y = Math.sin(newAngle) * speed;
          }
      }

      b.pos.x += b.velocity.x;
      b.pos.y += b.velocity.y;
      if (b.pos.x > w || b.pos.x < 0 || b.pos.y < 0 || b.pos.y > h) b.active = false;
    });

    // 4. Spawning
    if (!bossActiveRef.current) {
        spawnTimerRef.current += deltaTime;
        let rate = BASE_ENEMY_SPAWN_RATE;
        if (stageType === StageType.ENEMY_FLEET) rate = 500;
        if (stageType === StageType.ASTEROID_FIELD) rate = 1500;
        
        if (spawnTimerRef.current > rate) {
            spawnEnemy();
            spawnTimerRef.current = 0;
        }

        if (stageType === StageType.ASTEROID_FIELD || stageType === StageType.SPACE_FORTRESS) {
            obstacleSpawnTimerRef.current += deltaTime;
            const obsRate = stageType === StageType.ASTEROID_FIELD ? 800 : 1500;
            if (obstacleSpawnTimerRef.current > obsRate) {
                spawnObstacle();
                obstacleSpawnTimerRef.current = 0;
            }
        }
    }

    // 5. Update Obstacles
    obstaclesRef.current.forEach(obs => {
        obs.pos.x += obs.velocity.x;
        if (obs.type === 'rock') {
            obs.pos.y += Math.sin(obs.pos.x * 0.01) * 0.5;
        }
        if (obs.pos.x + obs.width < 0) obs.active = false;

         if (obs.active && player.active && Date.now() > player.invulnerableUntil) {
            const hitboxPadding = 5;
             if (
              player.pos.x + hitboxPadding < obs.pos.x + obs.width &&
              player.pos.x + player.width - hitboxPadding > obs.pos.x &&
              player.pos.y + hitboxPadding < obs.pos.y + obs.height &&
              player.pos.y + player.height - hitboxPadding > obs.pos.y
            ) {
                 handlePlayerDamage();
                 if (!obs.indestructible) {
                     obs.active = false;
                     createExplosion(obs.pos.x, obs.pos.y, obs.color, 15);
                 }
            }
         }

         if (!obs.indestructible) {
             bulletsRef.current.forEach(b => {
                 if (b.active && !b.isEnemy && obs.active) {
                    if (
                        b.pos.x < obs.pos.x + obs.width &&
                        b.pos.x + b.width > obs.pos.x &&
                        b.pos.y < obs.pos.y + obs.height &&
                        b.pos.y + b.height > obs.pos.y
                    ) {
                        if (!b.piercing && b.type !== 'PLASMA') b.active = false;
                        obs.hp -= b.damage;
                        if (obs.hp <= 0) {
                            obs.active = false;
                            createExplosion(obs.pos.x + obs.width/2, obs.pos.y + obs.height/2, obs.color, 8);
                            setScore(s => s + 50);
                        }
                    }
                 }
             });
         }
    });

    // 6. Update Enemies & Boss Logic
    enemiesRef.current.forEach(enemy => {
      if (enemy.type === 'boss') {
        if (enemy.pos.x > w - 250) {
           enemy.pos.x -= 2;
        } else {
           enemy.pos.y += Math.sin(Date.now() / 500) * 2;
           enemy.pos.x += Math.cos(Date.now() / 1000) * 1;
        }

        if (!enemy.attackTimer) enemy.attackTimer = 0;
        enemy.attackTimer += deltaTime;
        
        const attackRate = Math.max(800, 1500 - (stageIndex * 100));

        if (enemy.attackTimer > attackRate) {
           enemy.attackTimer = 0;
           
           // Multi-weapon Logic
           let simultaneousCount = 1;
           const rand = Math.random();

           if (stageIndex === 0) {
               simultaneousCount = 1;
           } else if (stageIndex === 1) {
               if (rand < 0.3) simultaneousCount = 2;
           } else if (stageIndex === 2) {
               if (rand < 0.6) simultaneousCount = 2;
           } else if (stageIndex >= 3) {
               if (rand < 0.3) simultaneousCount = 3;
               else simultaneousCount = 2;
           }

           const weaponPool: WeaponType[] = ['SPREAD', 'LASER', 'PLASMA', 'HOMING'];
           const selectedWeapons: WeaponType[] = [];
           
           for(let i=0; i<simultaneousCount; i++) {
               if (weaponPool.length === 0) break;
               const idx = Math.floor(Math.random() * weaponPool.length);
               selectedWeapons.push(weaponPool[idx]);
               weaponPool.splice(idx, 1);
           }

           selectedWeapons.forEach(weapon => {
                const dx = player.pos.x - enemy.pos.x;
                const dy = player.pos.y - (enemy.pos.y + enemy.height/2);
                const angle = Math.atan2(dy, dx);
                
                if (weapon === 'SPREAD') {
                    const bulletCount = 3 + Math.min(stageIndex, 4);
                    const spread = 0.2 + (stageIndex * 0.05);
                    for(let i = 0; i < bulletCount; i++) {
                        const offset = -spread + (i * (spread*2) / (bulletCount-1));
                        spawnBullet(
                            { x: enemy.pos.x, y: enemy.pos.y + enemy.height/2 },
                            angle + offset, 'STANDARD', false, true, 0.5
                        );
                    }
                } else if (weapon === 'LASER') {
                     spawnBullet(
                        { x: enemy.pos.x, y: enemy.pos.y + enemy.height/2 },
                        angle, 'LASER', false, true, 0.8
                    );
                } else if (weapon === 'PLASMA') {
                     spawnBullet(
                        { x: enemy.pos.x, y: enemy.pos.y + enemy.height/2 },
                        angle, 'PLASMA', false, true, 0.6
                    );
                } else if (weapon === 'HOMING') {
                    const count = 2 + Math.floor(stageIndex/2);
                    for(let i=0; i<count; i++) {
                        spawnBullet(
                            { x: enemy.pos.x, y: enemy.pos.y + enemy.height/2 + (Math.random()*40 - 20) },
                            angle + (Math.random() - 0.5), 'HOMING', false, true, 0.6
                        );
                    }
                }
           });
        }

      } else if (enemy.type === 'turret') {
         enemy.pos.x += enemy.velocity.x;
         if (Math.random() < 0.02) {
            const dx = player.pos.x - enemy.pos.x;
            const dy = player.pos.y - enemy.pos.y;
            const angle = Math.atan2(dy, dx);
            spawnBullet({ x: enemy.pos.x + 20, y: enemy.pos.y }, angle, 'STANDARD', false, true, 0.4);
         }
      } else {
        enemy.pos.x += enemy.velocity.x;
        enemy.pos.y += enemy.velocity.y;
        if (enemy.type === 'fighter') {
          enemy.pos.y += Math.sin(enemy.pos.x * 0.01) * 2;
        }

        let fireChance = 0.001 + (stageIndex * 0.003); 
        fireChance = Math.min(fireChance, 0.05);

        if (Math.random() < fireChance && enemy.pos.x < w - 50 && enemy.pos.x > 0) {
            const dx = player.pos.x - enemy.pos.x;
            const dy = player.pos.y - enemy.pos.y;
            const angle = Math.atan2(dy, dx);
            
            let count = 1;
            if (stageIndex >= 3 && (enemy.type === 'tank' || enemy.type === 'fighter')) count = 3;
            
            const spread = 0.3;
            
            for(let i=0; i<count; i++) {
                 const a = angle - ((count-1)*spread/2) + (i*spread);
                 spawnBullet({ x: enemy.pos.x, y: enemy.pos.y + enemy.height/2 }, a, 'STANDARD', false, true, 0.5);
            }
        }
      }

      if (enemy.pos.x + enemy.width < 0) enemy.active = false;

      bulletsRef.current.forEach(bullet => {
        if (!bullet.active || !enemy.active || bullet.isEnemy) return;

        // RESTRICTED HITBOX FOR BOSS
        let enemyHitWidth = enemy.width;
        if (enemy.type === 'boss') enemyHitWidth = enemy.width * 0.5; // Front 50% only

        if (
          bullet.pos.x < enemy.pos.x + enemyHitWidth &&
          bullet.pos.x + bullet.width > enemy.pos.x &&
          bullet.pos.y < enemy.pos.y + enemy.height &&
          bullet.pos.y + bullet.height > enemy.pos.y
        ) {
          if (!bullet.piercing && bullet.type !== 'PLASMA') bullet.active = false;
          
          enemy.hp -= bullet.damage;
          createExplosion(bullet.pos.x, bullet.pos.y, COLORS.playerBullet, 2);

          if (enemy.hp <= 0) {
            enemy.active = false;
            const isBoss = enemy.type === 'boss';
            
            createExplosion(
                enemy.pos.x + enemy.width / 2, 
                enemy.pos.y + enemy.height / 2, 
                enemy.color, 
                isBoss ? 50 : 15,
                isBoss ? 3 : 1
            );
            
            setScore(prev => prev + enemy.scoreValue);
            
            if (isBoss) {
               onBossDefeated();
               spawnItem(enemy.pos.x, enemy.pos.y, true);
               spawnItem(enemy.pos.x + 50, enemy.pos.y + 50, true);
               spawnItem(enemy.pos.x + 25, enemy.pos.y + 100, true);
            } else {
               spawnItem(enemy.pos.x, enemy.pos.y);
            }
          }
        }
      });

      if (enemy.active && player.active && Date.now() > player.invulnerableUntil) {
        const hitboxPadding = 5;
        if (
          player.pos.x + hitboxPadding < enemy.pos.x + enemy.width &&
          player.pos.x + player.width - hitboxPadding > enemy.pos.x &&
          player.pos.y + hitboxPadding < enemy.pos.y + enemy.height &&
          player.pos.y + player.height - hitboxPadding > enemy.pos.y
        ) {
          handlePlayerDamage();
          if (enemy.type !== 'boss') enemy.active = false; 
        }
      }
    });
    
    bulletsRef.current.forEach(bullet => {
        if (bullet.active && bullet.isEnemy && player.active && Date.now() > player.invulnerableUntil) {
            if (
              player.pos.x < bullet.pos.x + bullet.width &&
              player.pos.x + player.width > bullet.pos.x &&
              player.pos.y < bullet.pos.y + bullet.height &&
              player.pos.y + player.height > bullet.pos.y
            ) {
                bullet.active = false;
                handlePlayerDamage();
            }
        }
    });

    itemsRef.current.forEach(item => {
        item.pos.x += item.velocity.x;
        item.pos.y += item.velocity.y;
        if (item.pos.x < -50) item.active = false;

        if (item.active && player.active) {
             if (
              player.pos.x < item.pos.x + item.width &&
              player.pos.x + player.width > item.pos.x &&
              player.pos.y < item.pos.y + item.height &&
              player.pos.y + player.height > item.pos.y
            ) {
                item.active = false;
                applyItemEffect(item.type);
                createExplosion(item.pos.x, item.pos.y, '#ffffff', 5);
            }
        }
    });

    particlesRef.current.forEach(p => {
      p.pos.x += p.velocity.x;
      p.pos.y += p.velocity.y;
      p.life -= 0.02;
      if (p.life <= 0) p.active = false;
    });

    bulletsRef.current = bulletsRef.current.filter(b => b.active);
    enemiesRef.current = enemiesRef.current.filter(e => e.active);
    particlesRef.current = particlesRef.current.filter(p => p.active);
    itemsRef.current = itemsRef.current.filter(i => i.active);
    obstaclesRef.current = obstaclesRef.current.filter(o => o.active);

    draw();
    requestRef.current = requestAnimationFrame(() => update(Date.now()));
  };

  const handlePlayerDamage = () => {
     const player = playerRef.current;
     
     if (player.shield > 0) {
         player.shield -= 1;
         player.invulnerableUntil = Date.now() + 1000;
         createExplosion(player.pos.x, player.pos.y, COLORS.itemShield, 10);
         return;
     }

     player.hp -= 1;
     setLives(player.hp);
     player.invulnerableUntil = Date.now() + PLAYER_INVULNERABILITY_TIME;
     // On damage, downgrade bits or reset? Let's keep weapons but maybe lose a bit?
     // Keeping simple for now.
     createExplosion(player.pos.x, player.pos.y, COLORS.player, 20);

     if (player.hp <= 0) {
        setGameState(GameState.GAME_OVER);
     }
  };

  const applyItemEffect = (type: ItemType) => {
      const player = playerRef.current;
      switch (type) {
          case 'weapon_spread':
              player.weaponType = 'SPREAD';
              break;
          case 'weapon_laser':
              player.weaponType = 'LASER';
              break;
          case 'weapon_plasma':
              player.weaponType = 'PLASMA';
              break;
          case 'weapon_homing':
              player.weaponType = 'HOMING';
              break;
          case 'bit':
              player.bits = Math.min(player.bits + 1, MAX_BIT_LEVEL);
              break;
          case 'shield':
              player.shield = Math.min(player.shield + 1, MAX_SHIELD_LEVEL);
              break;
          case 'health':
              player.hp = Math.min(player.hp + 1, player.maxHp);
              setLives(player.hp);
              break;
      }
      setScore(prev => prev + 500);
  };

  // --- Graphics Renderers ---

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: Player) => {
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      
      if (Date.now() < p.invulnerableUntil && Math.floor(Date.now() / 100) % 2 === 0) {
          ctx.globalAlpha = 0.5;
      }

      const flameLen = Math.random() * 20 + 10;
      ctx.fillStyle = '#ffaa00';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(0, p.height / 2 - 5);
      ctx.lineTo(-flameLen, p.height / 2);
      ctx.lineTo(0, p.height / 2 + 5);
      ctx.fill();
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      
      ctx.beginPath();
      ctx.moveTo(p.width, p.height / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(10, p.height / 2);
      ctx.lineTo(0, p.height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(p.width - 10, p.height/2);
      ctx.lineTo(p.width - 20, p.height/2 - 3);
      ctx.lineTo(p.width - 20, p.height/2 + 3);
      ctx.fill();

      if (p.bits > 0) {
          const bitSpacing = 40;
          ctx.fillStyle = '#00ffaa';
          
          for(let i=0; i < p.bits; i++) {
              const pairIndex = Math.floor(i / 2);
              const isTop = i % 2 === 0;
              const yOffset = (pairIndex + 1) * bitSpacing * (isTop ? -1 : 1);
              const bitY = p.height/2 + yOffset;

              ctx.beginPath();
              ctx.arc(-15, bitY, 6, 0, Math.PI*2);
              ctx.fill();
              ctx.shadowColor = '#00ffaa';
              ctx.shadowBlur = 5;
          }
      }
      
      if (p.shield > 0) {
          ctx.shadowBlur = 0;
          for(let i=0; i<p.shield; i++) {
              ctx.strokeStyle = `rgba(0, 200, 255, ${0.4 + (i * 0.2)})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(p.width/2, p.height/2, p.width + (i*5), 0, Math.PI*2);
              ctx.stroke();
          }
      }
      
      ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      
      if (e.type === 'boss') {
          ctx.translate(e.width/2, e.height/2);
          
          ctx.save();
          ctx.rotate(Date.now() / 1000);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, e.width/2 - 10, 0, Math.PI*2);
          ctx.stroke();
          for(let i=0; i<8; i++) {
              ctx.rotate(Math.PI/4);
              ctx.fillRect(e.width/2 - 15, -5, 20, 10);
          }
          ctx.restore();

          ctx.fillStyle = '#ff0000';
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(0, 0, 30, 0, Math.PI*2);
          ctx.fill();
          
          ctx.translate(-e.width/2, -e.height/2);
          const hpPercent = e.hp / e.maxHp;
          ctx.fillStyle = '#550000';
          ctx.fillRect(0, -20, e.width, 8);
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(0, -20, e.width * hpPercent, 8);

      } else if (e.type === 'turret') {
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(20, 30, 15, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(20, 20, 10, 0, Math.PI*2);
          ctx.fill();
          const dx = playerRef.current.pos.x - e.pos.x;
          const dy = playerRef.current.pos.y - e.pos.y;
          const angle = Math.atan2(dy, dx);
          ctx.save();
          ctx.translate(20, 20);
          ctx.rotate(angle);
          ctx.fillStyle = '#aaa';
          ctx.fillRect(0, -3, 25, 6);
          ctx.restore();

      } else if (e.type === 'tank') {
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(e.width-10, 0);
          ctx.lineTo(e.width, e.height/2);
          ctx.lineTo(e.width-10, e.height);
          ctx.lineTo(10, e.height);
          ctx.lineTo(0, e.height/2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(15, 15, e.width-30, e.height-30);

      } else if (e.type === 'fighter') {
          ctx.beginPath();
          ctx.moveTo(e.width, e.height/2);
          ctx.lineTo(0, 0);
          ctx.lineTo(10, e.height/2);
          ctx.lineTo(0, e.height);
          ctx.closePath();
          ctx.fill();

      } else {
          ctx.beginPath();
          ctx.moveTo(e.width, e.height/2);
          ctx.lineTo(0, e.height/4);
          ctx.lineTo(0, e.height*0.75);
          ctx.closePath();
          ctx.fill();
      }
      ctx.restore();
  };

  const drawItem = (ctx: CanvasRenderingContext2D, i: Item) => {
      ctx.save();
      ctx.translate(i.pos.x + i.width/2, i.pos.y + i.height/2);
      
      const scale = 1 + Math.sin(Date.now() / 150) * 0.1;
      ctx.scale(scale, scale);

      ctx.shadowBlur = 10;
      ctx.shadowColor = i.color;
      
      ctx.fillStyle = i.color;
      ctx.beginPath();
      ctx.arc(0, 0, i.width/2, 0, Math.PI*2);
      ctx.fill();
      
      const grad = ctx.createRadialGradient(-2, -2, 2, 0, 0, i.width/2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, i.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, i.width/2 - 2, 0, Math.PI*2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px "Press Start 2P"'; // Retro font for icon
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let letter = '';
      switch(i.type) {
          case 'weapon_plasma': letter = 'P'; break;
          case 'weapon_laser': letter = 'L'; break;
          case 'weapon_homing': letter = 'H'; break;
          case 'weapon_spread': letter = 'S'; break;
          case 'bit': letter = 'B'; break;
          case 'shield': letter = 'O'; break;
          case 'health': letter = '+'; break;
      }
      ctx.fillText(letter, 0, 2);

      ctx.restore();
  };

  const drawObstacle = (ctx: CanvasRenderingContext2D, o: Obstacle) => {
      ctx.save();
      ctx.translate(o.pos.x, o.pos.y);
      ctx.fillStyle = o.color;
      
      if (o.type === 'rock') {
          ctx.beginPath();
          const r = o.width/2;
          ctx.translate(r, r);
          for(let i=0; i<8; i++) {
              const ang = (i / 8) * Math.PI * 2;
              const rad = r * (0.8 + Math.random() * 0.4); 
              const px = Math.cos(ang) * rad;
              const py = Math.sin(ang) * rad;
              if (i===0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.arc(-5, -5, r/4, 0, Math.PI*2);
          ctx.fill();

      } else {
          ctx.fillRect(0, 0, o.width, o.height);
          ctx.strokeStyle = '#666';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(5, 5);
          ctx.lineTo(o.width-5, 5);
          ctx.lineTo(o.width-5, o.height-5);
          ctx.lineTo(5, o.height-5);
          ctx.closePath();
          ctx.stroke();
          
          ctx.fillStyle = '#ff0000';
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 5;
          ctx.fillRect(o.width/2 - 2, 10, 4, o.height-20);
      }
      ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = screenRef.current;

    ctx.clearRect(0, 0, w, h);

    if (stageType === StageType.PLANET_SURFACE) {
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(0, h - 60, w, 60);
        const offset = (Date.now() / 5) % 100;
        ctx.fillStyle = '#3a3a3a';
        for(let i = 0; i < w + 100; i+=100) {
            ctx.fillRect(i - offset, h - 60, 20, 10);
        }
    }

    obstaclesRef.current.forEach(obs => drawObstacle(ctx, obs));
    enemiesRef.current.forEach(e => drawEnemy(ctx, e));

    if (playerRef.current.active) {
        drawPlayer(ctx, playerRef.current);
    }

    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.type === 'PLASMA' || b.type === 'LASER' ? 15 : 5;
      
      if (b.type === 'PLASMA') {
          ctx.beginPath();
          ctx.arc(b.pos.x + b.width/2, b.pos.y + b.height/2, b.height, 0, Math.PI*2);
          ctx.fill();
          // Plasma Core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b.pos.x + b.width/2, b.pos.y + b.height/2, b.height/2, 0, Math.PI*2);
          ctx.fill();
      } else if (b.type === 'LASER') {
          ctx.fillRect(b.pos.x, b.pos.y, b.width, b.height);
      } else if (b.type === 'HOMING') {
          // Missile Shape
          ctx.save();
          ctx.translate(b.pos.x + b.width/2, b.pos.y + b.height/2);
          const angle = Math.atan2(b.velocity.y, b.velocity.x);
          ctx.rotate(angle);
          ctx.fillStyle = b.color;
          ctx.fillRect(-b.width/2, -b.height/2, b.width, b.height);
          // Engine trail
          ctx.fillStyle = 'white';
          ctx.fillRect(-b.width, -1, 4, 2);
          ctx.restore();
      } else {
          // Standard bullets are round
          ctx.beginPath();
          ctx.arc(b.pos.x + b.width/2, b.pos.y + b.height/2, b.height/2, 0, Math.PI*2);
          ctx.fill();
      }
      ctx.shadowBlur = 0;
    });

    itemsRef.current.forEach(i => drawItem(ctx, i));

    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 5;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });

    if (gameState === GameState.BOSS_WARNING) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(Date.now() / 100) * 0.5})`;
        ctx.font = 'bold 48px "Rajdhani"';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'red';
        ctx.shadowBlur = 20;
        ctx.fillText("WARNING: HUGE BATTLESHIP APPROACHING", w / 2, h / 2);
        ctx.restore();
    } else if (gameState === GameState.PLAYING && !bossActiveRef.current) {
        const barW = 200;
        const barH = 10;
        const pct = Math.min(stageProgressRef.current / STAGE_DURATION, 1);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(w/2 - barW/2, 20, barW, barH);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.fillRect(w/2 - barW/2, 20, barW * pct, barH);
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("DISTANCE TO TARGET", w/2, 15);
    }
  };

  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
            screenRef.current = { w: window.innerWidth, h: window.innerHeight };
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState === GameState.BRIEFING) {
       setupStage();
    }
    if (gameState === GameState.MENU) {
       resetGame();
    }
    if (gameState === GameState.PLAYING || gameState === GameState.BOSS_WARNING) {
        if (playerRef.current.hp <= 0) resetGame();
        lastTimeRef.current = Date.now();
        requestRef.current = requestAnimationFrame(() => update(Date.now()));
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, setupStage, resetGame]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { active: true, x: touch.clientX, y: touch.clientY };
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.touches[0];
      touchRef.current.x = touch.clientX;
      touchRef.current.y = touch.clientY;
  };

  const handleTouchEnd = () => { touchRef.current = null; };

  return (
    <canvas
    ref={canvasRef}
    className="block w-full h-full touch-none"
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
    />
  );
};