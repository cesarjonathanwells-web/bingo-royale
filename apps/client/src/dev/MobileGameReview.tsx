import { createRoot } from "react-dom/client";
import { useState } from "react";
import "@/i18n";
import "@/app.css";
import { GameView } from "@/components/game/GameView";
import { generateCard75, generateCard90, type BingoVariant, type Room, type GameState } from "@bingo/shared";

const params = new URLSearchParams(location.search);
const variant: BingoVariant = params.get("variant") === "90" ? "90" : "75";
const count = Math.max(1, Math.min(4, Number(params.get("count")) || 4));
const room: Room = {code:"REVIEW",hostId:"host",variant,state:"in_progress",speed:5000,patterns:variant==="75"?["top_row"]:["one_line"],customPatterns:[],playerLimit:20,players:[{id:"local",name:"Local player",isHost:false,connected:true,isSpectator:false}],createdAt:0};
const gameState: GameState = {calledNumbers:Array.from({length:variant==="75"?75:90},(_,i)=>i+1),currentNumber:22,currentLetter:variant==="75"?"I":null,paused:false,startedAt:0,winners:[]};
function MobileGameReview() {
 const [cards] = useState(()=>Array.from({length:count},()=>variant==="75"?generateCard75():generateCard90()));
 const [dabs,setDabs] = useState(()=>cards.map(()=>new Set<number>()));
 const [active,setActive] = useState(0);
 const [used,setUsed] = useState(false);
 const dab = (ci:number,cell:number) => setDabs(previous=>previous.map((marks,i)=>i===ci?new Set([...marks,cell]):marks));
 return <GameView room={room} gameState={gameState} myCards={cards} myDabs={dabs} activeCardIndex={active}
  myPowerUps={[{id:"wild_square",used}]} peekedNumbers={[]} chatMessages={[]} reactions={[]} isHost={false}
  onSetActiveCard={setActive} onDab={cell=>dab(active,cell)} onDabMulti={dab} onClaimBingo={()=>{}}
  onPauseGame={()=>{}} onResumeGame={()=>{}} onUsePowerUp={()=>setUsed(true)} onSendChat={()=>{}} onSendReaction={()=>{}} onLeave={()=>{}} />;
}
createRoot(document.getElementById("root")!).render(<MobileGameReview />);
