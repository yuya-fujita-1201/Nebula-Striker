
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Starfield } from './components/Starfield';
import { GameState, MissionData, StageType } from './types';
import { generateMissionBriefing } from './services/geminiService';
import { Play, Shield, Trophy, Target, Skull, MapPin } from 'lucide-react';

const STAGE_ORDER = [
  StageType.DEEP_SPACE,
  StageType.ASTEROID_FIELD,
  StageType.ENEMY_FLEET,
  StageType.PLANET_SURFACE,
  StageType.SPACE_FORTRESS
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [missionData, setMissionData] = useState<MissionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [stageIndex, setStageIndex] = useState(0);
  const currentStage = STAGE_ORDER[stageIndex % STAGE_ORDER.length];

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('nebula_hs');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('nebula_hs', score.toString());
    }
  }, [score, highScore]);

  // Auto-start logic for briefing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === GameState.BRIEFING && !isLoading && missionData) {
       timer = setTimeout(() => {
           setGameState(GameState.PLAYING);
       }, 4000);
    }
    return () => clearTimeout(timer);
  }, [gameState, isLoading, missionData]);

  const startGameFlow = async (resetStage: boolean = true) => {
    if (resetStage) setStageIndex(0);
    setIsLoading(true);
    setGameState(GameState.BRIEFING);
    
    const nextStage = resetStage ? STAGE_ORDER[0] : STAGE_ORDER[stageIndex % STAGE_ORDER.length];
    
    // Fetch briefing from Gemini with stage context
    const briefing = await generateMissionBriefing(score, nextStage);
    setMissionData(briefing);
    setIsLoading(false);
  };

  const handleBossDefeated = () => {
    // Boss beaten, wait a moment then go to next briefing
    setTimeout(() => {
        setStageIndex(prev => prev + 1);
        startGameFlow(false);
    }, 3000);
  };

  return (
    <div className="w-full h-screen bg-neutral-950 overflow-hidden text-white relative scanlines select-none m-0 p-0">
      {/* Background */}
      <Starfield speedMultiplier={gameState === GameState.PLAYING ? 4 : 0.5} stageType={currentStage} />

      {/* Main Game Canvas (Full Screen) */}
      <div className="absolute inset-0 z-10">
        <GameCanvas 
            gameState={gameState} 
            setGameState={setGameState}
            score={score}
            setScore={setScore}
            lives={lives}
            setLives={setLives}
            stageType={currentStage}
            stageIndex={stageIndex}
            onBossDefeated={handleBossDefeated}
        />
      </div>

      {/* UI Overlay: HUD */}
      {(gameState === GameState.PLAYING || gameState === GameState.BOSS_WARNING) && (
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-20">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-cyan-400 font-bold retro-font tracking-widest">SCORE</span>
              <span className="text-3xl text-white font-mono drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{score.toString().padStart(6, '0')}</span>
            </div>
             <div className="flex flex-col opacity-80">
              <span className="text-xs text-cyan-400 font-bold retro-font tracking-widest">HIGH</span>
              <span className="text-3xl text-white font-mono drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{highScore.toString().padStart(6, '0')}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-yellow-400 font-bold retro-font tracking-widest flex items-center gap-2">
                  <MapPin size={12} /> {currentStage.toUpperCase()}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-red-500 font-bold retro-font animate-pulse">ARMOR</span>
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <Shield 
                      key={i} 
                      size={28} 
                      className={`${i < lives ? 'text-cyan-400 fill-cyan-400/20' : 'text-gray-800'}`} 
                    />
                  ))}
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Menu Screen */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30 backdrop-blur-sm">
          <h1 className="text-6xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 retro-font mb-4 drop-shadow-[0_0_25px_rgba(0,200,255,0.5)] text-center">
            NEBULA<br/>STRIKER
          </h1>
          <p className="text-cyan-200/60 mb-16 tracking-[0.8em] text-lg uppercase">AI Tactical Defense System</p>
          
          <button
            onClick={() => startGameFlow(true)}
            className="group relative px-16 py-6 bg-cyan-950/60 border border-cyan-500/50 hover:bg-cyan-900/80 hover:border-cyan-400 transition-all duration-300"
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="w-full h-[1px] bg-cyan-400 shadow-[0_0_15px_#0ff]"></div>
            </div>
            <div className="flex items-center gap-4 text-cyan-300 font-bold text-2xl retro-font">
              <Play className="fill-current" />
              INITIATE
            </div>
          </button>
          
          <div className="mt-12 text-sm text-gray-500 font-mono uppercase tracking-wider">
            WASD / ARROWS to MOVE • SPACE / TOUCH to SHOOT
          </div>
        </div>
      )}

      {/* Mission Briefing Screen */}
      {gameState === GameState.BRIEFING && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-30 p-8">
          <div className="max-w-3xl w-full border-y-4 border-cyan-900/50 bg-black p-12 relative min-h-[400px] flex flex-col items-center justify-center">
            {isLoading ? (
               <div className="flex flex-col items-center gap-6">
                 <div className="w-20 h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-cyan-400 font-mono text-xl animate-pulse tracking-widest">DECRYPTING MISSION DATA...</p>
               </div>
            ) : (
              <>
                <div className="absolute top-0 left-0 bg-cyan-600 text-black px-4 py-1 text-sm font-bold tracking-widest flex items-center gap-2">
                    INCOMING TRANSMISSION: STAGE {(stageIndex % STAGE_ORDER.length) + 1}
                </div>
                <div className="absolute top-0 right-0 px-4 py-1 text-yellow-500 font-mono text-xs tracking-widest">
                    SECTOR: {currentStage.toUpperCase()}
                </div>
                
                <h2 className="text-4xl md:text-5xl font-bold text-cyan-400 mb-10 w-full border-b border-gray-800 pb-4 text-center retro-font">{missionData?.title}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full mb-12">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-gray-400 text-sm uppercase tracking-widest"><Target size={20}/> Objective</div>
                    <p className="text-xl text-white leading-relaxed font-mono">{missionData?.description}</p>
                  </div>
                  <div className="space-y-4 border-l-2 border-gray-800 pl-8">
                    <div className="flex items-center gap-3 text-red-400 text-sm uppercase tracking-widest"><Skull size={20}/> Threat Assessment</div>
                    <p className="text-4xl text-red-500 font-bold tracking-widest retro-font">{missionData?.target}</p>
                  </div>
                </div>

                <div className="w-full mt-auto">
                    <div className="text-center text-cyan-500/60 font-mono text-sm mb-2 tracking-widest animate-pulse">AUTO-ENGAGE SEQUENCE INITIATED...</div>
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 animate-[width_4s_linear_forwards] w-0"></div>
                    </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center z-40 backdrop-blur-md animate-in fade-in duration-1000">
          <h2 className="text-7xl md:text-9xl font-bold text-red-500 retro-font mb-4 drop-shadow-[0_0_50px_rgba(255,0,0,0.8)]">GAME OVER</h2>
          <div className="flex flex-col md:flex-row items-center gap-8 mb-12 bg-black/60 px-12 py-8 rounded-lg border border-red-500/30">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2 tracking-widest">FINAL SCORE</p>
              <p className="text-5xl text-white font-mono">{score}</p>
            </div>
            <div className="w-full h-[1px] md:w-[1px] md:h-16 bg-gray-600"></div>
            <div className="text-center">
              <p className="text-sm text-yellow-400 mb-2 flex items-center justify-center gap-2 tracking-widest"><Trophy size={16}/> BEST</p>
              <p className="text-5xl text-yellow-400 font-mono">{highScore}</p>
            </div>
          </div>
          
          <button
            onClick={() => setGameState(GameState.MENU)}
            className="px-10 py-4 border border-white/30 hover:bg-white/10 text-white text-lg font-mono tracking-[0.2em] transition-all"
          >
            RETURN TO BASE
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
