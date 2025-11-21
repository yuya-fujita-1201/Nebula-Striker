const SPRITE_MANIFEST = {
  player: '/sprites/player-ship.png',
  enemyScout: '/sprites/enemy-scout.png',
  enemyFighter: '/sprites/enemy-fighter.png',
  enemyTank: '/sprites/enemy-tank.png',
  enemyBoss: '/sprites/enemy-boss.png',
  enemyTurret: '/sprites/enemy-turret.png',
  obstacleRock: '/sprites/obstacle-rock.png',
  obstacleWall: '/sprites/obstacle-wall.png',
};

export type SpriteKey = keyof typeof SPRITE_MANIFEST;
export type SpriteMap = Partial<Record<SpriteKey, HTMLImageElement>>;

const loadSingleImage = (key: SpriteKey, src: string): Promise<[SpriteKey, HTMLImageElement | null]> => {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve([key, img]);
    img.onerror = () => resolve([key, null]);
    img.src = src;
  });
};

export const loadSprites = async (): Promise<SpriteMap> => {
  const entries = await Promise.all(
    (Object.keys(SPRITE_MANIFEST) as SpriteKey[]).map(key =>
      loadSingleImage(key, SPRITE_MANIFEST[key])
    )
  );

  return entries.reduce<SpriteMap>((acc, [key, img]) => {
    if (img) acc[key] = img;
    return acc;
  }, {});
};

export const getSpritePath = (key: SpriteKey) => SPRITE_MANIFEST[key];
