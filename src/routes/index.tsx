import { createFileRoute } from "@tanstack/react-router";
import { GameView } from "@/components/game-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="h-dvh overflow-hidden bg-bg">
      <GameView />
    </main>
  );
}
