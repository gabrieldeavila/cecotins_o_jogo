import { Boot } from "./scenes/Boot";
import { GameOver } from "./scenes/GameOver";
import { Game as MainGame } from "./scenes/Game";
import { MainMenu } from "./scenes/MainMenu";
import { AUTO, Game } from "phaser";
import { Preloader } from "./scenes/Preloader";
import { GameInputContextData } from "../context/game";

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const baseConfig: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: "game-container",
    backgroundColor: "#028af8",
    scene: [Boot, Preloader, MainMenu, MainGame, GameOver],
    render: {
        pixelArt: true,
        antialias: false,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 600 }, // Gravidade para o boneco cair
            debug: import.meta.env.DEV,
        },
    },
};

const StartGame = (
    parent: string,
    controlsRef: GameInputContextData["controlsRef"],
) => {
    return new Game({
        ...baseConfig,
        parent,
        callbacks: {
            preBoot: (game) => {
                game.registry.set("controlsRef", controlsRef);
            },
        },
    });
};

export default StartGame;
