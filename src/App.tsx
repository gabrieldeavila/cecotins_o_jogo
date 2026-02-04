import { useRef } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import Joystick from "./game/ux/joystick";
import { GameInputProvider } from "./context/game";

function App() {
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    // Event emitted from the PhaserGame component

    return (
        <GameInputProvider>
            <div id="app">
                <PhaserGame ref={phaserRef} />
                <Joystick />
            </div>
        </GameInputProvider>
    );
}

export default App;
