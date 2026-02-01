import { Scene } from "phaser";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init() {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, "background");

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on("progress", (progress: number) => {
            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
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
    }

    create() {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start("Game");
    }
}

