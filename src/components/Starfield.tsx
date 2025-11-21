
import React, { useEffect, useRef } from 'react';
import { Star, StageType } from '../types';

export const Starfield: React.FC<{ speedMultiplier?: number, stageType: StageType }> = ({ speedMultiplier = 1, stageType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const requestRef = useRef<number>(0);

  const initStars = (width: number, height: number) => {
    const stars: Star[] = [];
    let countMod = 1;
    if (stageType === StageType.SPACE_FORTRESS) countMod = 0.2; // Fewer stars inside
    
    const starCount = Math.floor((width * height) / 4000 * countMod); 
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: Math.random() * 2 + 0.5,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random()
      });
    }
    starsRef.current = stars;
  };

  const update = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    
    // Background color tweaks
    if (stageType === StageType.PLANET_SURFACE) {
         const grad = ctx.createLinearGradient(0, 0, 0, height);
         grad.addColorStop(0, '#050510');
         grad.addColorStop(1, '#1a1a2e'); // Slight atmosphere at bottom
         ctx.fillStyle = grad;
    } else if (stageType === StageType.SPACE_FORTRESS) {
         ctx.fillStyle = '#0a0a0a';
    } else {
         ctx.fillStyle = '#050505';
    }
    
    ctx.fillRect(0, 0, width, height);

    // Draw stars
    starsRef.current.forEach((star) => {
      star.x -= star.speed * speedMultiplier;

      if (star.x < 0) {
        star.x = width;
        star.y = Math.random() * height;
      }

      ctx.globalAlpha = star.brightness;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
            initStars(window.innerWidth, window.innerHeight);
        }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Init
    
    requestRef.current = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedMultiplier, stageType]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full block -z-10"
    />
  );
};
