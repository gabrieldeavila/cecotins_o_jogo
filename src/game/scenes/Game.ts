import { BaseScene, LevelConfig } from "./BaseScene";

export class Game extends BaseScene {
    constructor() {
        // Nome interno da cena no Phaser
        super("Game");
    }

    /**
     * Definimos apenas os dados desta fase.
     * A BaseScene fará todo o trabalho pesado de carregar e configurar.
     */
    getLevelConfig(): LevelConfig {
        return {
            mapId: "mapa_fase1",
            tileSetTerrain: "terrain-tiles",
            tileSetBackground: "blue-img",
            bgMusicKey: "theme_music",
        };
    }

    /**
     * Se você precisar de algo específico do Level 1
     * (ex: uma porta que só abre aqui), use o afterCreate.
     */
    protected afterCreate() {
        console.log("Level 1 iniciado com sucesso!");
        // Ex: Adicionar um NPC específico
    }
}
