import { useRef } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";

function App() {
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    // Event emitted from the PhaserGame component

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} />
            {/* <div>
                <div>
                    <button className="button" onClick={changeScene}>
                        Change Scene
                    </button>
                </div>
                <div>
                    <button
                        disabled={canMoveSprite}
                        className="button"
                        onClick={moveSprite}
                    >
                        Toggle Movement
                    </button>
                </div>
                <div className="spritePosition">
                    Sprite Position:
                    <pre>{`{\n  x: ${spritePosition.x}\n  y: ${spritePosition.y}\n}`}</pre>
                </div>
                <div>
                    <button className="button" onClick={addSprite}>
                        Add New Sprite
                    </button>
                </div>
            </div> */}
        </div>
    );
}

export default App;
