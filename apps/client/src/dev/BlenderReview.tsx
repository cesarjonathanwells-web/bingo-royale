import { createRoot } from "react-dom/client";
import { useState } from "react";
import "@/i18n";
import "@/app.css";
import { BingoBallScene } from "@/components/3d/BingoBallScene";
import { BallCall3D } from "@/components/3d/BallCall3D";
import { BlenderIcon } from "@/components/3d/BlenderIcon";
import { NumberBall } from "@/components/bingo/NumberBall";
import { BingoCell } from "@/components/bingo/BingoCell";
import { PowerUpBar } from "@/components/bingo/PowerUpBar";
import { POWER_UPS, type PlayerPowerUp } from "@bingo/shared";

function Review() {
  const [number, setNumber] = useState(7);
  const [used, setUsed] = useState<string[]>([]);
  const [marked, setMarked] = useState(false);
  const powerups: PlayerPowerUp[] = POWER_UPS.map(p => ({id:p.id,used:used.includes(p.id)}));
  return <main className="p-6 max-w-5xl mx-auto space-y-8">
    <h1 className="text-gold text-2xl font-gaming">Original design · Blender enhancements</h1>
    <p className="text-sm text-[var(--color-text-secondary)]">Local component review. No multiplayer connection.</p>
    <section className="glass-card rounded-2xl p-6"><h2 className="text-gold mb-4">Existing home animations</h2><BingoBallScene /></section>
    <section className="glass-card rounded-2xl p-6 flex flex-wrap items-center gap-6"><h2 className="text-gold">Number calls</h2><BallCall3D number={number} /><button className="glass-btn p-3 rounded-xl" onClick={()=>setNumber(n=>n>=75?1:n+15)}>Next call</button><NumberBall number={90} is75={false} size="sm"/><NumberBall number={90} is75={false} size="lg"/></section>
    <section className="glass-card rounded-2xl p-6"><h2 className="text-gold mb-4">Existing power-up controls</h2><PowerUpBar powerups={powerups.slice(0,3)} onUse={id=>setUsed(prev=>[...prev,id])}/></section>
    <section className="glass-card rounded-2xl p-6 flex flex-wrap gap-5">{POWER_UPS.map(p=><div key={p.id} className="flex flex-col items-center gap-2 text-xs"><BlenderIcon name={p.id} className="w-10 h-10">{p.icon}</BlenderIcon><span>{p.name}</span></div>)}</section>
    <section className="glass-card rounded-2xl p-6 flex flex-wrap gap-8 items-center"><h2 className="text-gold">Card marks and crown</h2><div className="w-16"><BingoCell index={0} value={7} column={0} dabbed={marked} onDab={()=>setMarked(v=>!v)}/></div><div className="w-16"><BingoCell index={12} value={null} column={2} dabbed onDab={()=>{}}/></div><BlenderIcon name="crown" className="w-16 h-16"><span>♛</span></BlenderIcon><BlenderIcon name="missing-review-asset" className="w-8 h-8"><span>★</span></BlenderIcon></section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Review />);
