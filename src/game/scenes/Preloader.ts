import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.add
            .rectangle(centerX, centerY, 468, 32)
            .setStrokeStyle(1, 0xffffff);

        // Subtraímos metade da largura total da barra (460/2 = 230) para alinhar à esquerda do centro
        const bar = this.add.rectangle(centerX - 230, centerY, 4, 28, 0xffffff);

        this.load.on("progress", (progress: number) => {
            // Atualiza a largura baseada no progresso (0 a 1)
            bar.width = 4 + 460 * progress;
        });
    }

    preload() {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath("assets");

        this.load.image("logo", "logo.png");
        this.load.image("star", "star.png");

        this.load.tilemapTiledJSON("mapa_fase1", "level1.json");
        this.load.image("terrain-tiles", "terrain.png");
        this.load.image("blue-img", "Blue.png");

        this.load.spritesheet("strawberry", "Strawberry.png", {
            frameWidth: 32,
            frameHeight: 32,
        });

        this.load.spritesheet("finish", "End (Idle).png", {
            frameWidth: 64,
            frameHeight: 64,
        });

        this.load.spritesheet("collected", "Collected.png", {
            frameWidth: 32,
            frameHeight: 32,
        });

        this.load.image("dust", "Dust Particle.png");

        // 4. O Spritesheet do Player (Sapinho/Mascarado)
        this.load.spritesheet("player_idle", "ninja/Idle (32x32).png", {
            frameWidth: 32,
            frameHeight: 32,
        });
        this.load.spritesheet("player_run", "ninja/Run (32x32).png", {
            frameWidth: 32,
            frameHeight: 32,
        });
        this.load.spritesheet("player_jump", "ninja/Jump (32x32).png", {
            frameWidth: 32,
            frameHeight: 32,
        });
        this.load.spritesheet("player_fall", "ninja/Fall (32x32).png", {
            frameWidth: 32,
            frameHeight: 32,
        });
        this.load.spritesheet(
            "player_wall_jump",
            "ninja/Wall Jump (32x32).png",
            {
                frameWidth: 32,
                frameHeight: 32,
            },
        );
        this.load.spritesheet(
            "player_double_jump",
            "ninja/Double Jump (32x32).png",
            {
                frameWidth: 32,
                frameHeight: 32,
            },
        );

        this.load.audio("jump_sfx", "sounds/jump.wav");
        this.load.audio("pickup_sfx", "sounds/pickup.wav");
        this.load.audio("step_sfx", "sounds/step.wav");
        this.load.audio("slide_sfx", "sounds/slide.wav");
        this.load.audio("fall_sfx", "sounds/fall.wav");

        this.load.audio("theme_music", "music/theme.mp3");

        // crab
        for (let i = 1; i <= 9; i++) {
            this.load.image(`crab_idle_${i}`, `crab/Idle 0${i}.png`);
        }
    }

    create() {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start("Game");
    }
}

