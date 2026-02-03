import Phaser, { Scene } from "phaser";

export class Game extends Scene {
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private worldLayer: Phaser.Tilemaps.TilemapLayer;
    private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private wasInAir: boolean = false;
    private dustTimer: number = 0;

    // Novo timer para controlar o ritmo dos passos
    private stepTimer: number = 0;

    // Timer para o som de deslizar na parede
    private wallSlideTimer: number = 0;

    // 1. Variável de controle para o Pulo Duplo
    private canDoubleJump: boolean = false;

    // 2. Propriedades de Som
    private jumpSound: Phaser.Sound.BaseSound;
    private fallSound: Phaser.Sound.BaseSound;
    private collectSound: Phaser.Sound.BaseSound;
    private stepSound: Phaser.Sound.BaseSound;
    private slideSound: Phaser.Sound.BaseSound;
    private bgMusic: Phaser.Sound.BaseSound;

    constructor() {
        super("Game");
    }

    create() {
        // --- 1. CRIAR O MAPA ---
        const map = this.make.tilemap({ key: "mapa_fase1" });
        const tileset = map.addTilesetImage("terrain", "terrain-tiles");
        const tilesetBlue = map.addTilesetImage("Blue back", "blue-img");

        this.cursors = this.input.keyboard!.createCursorKeys();

        // --- 2. CRIAR AS CAMADAS ---
        const bgLayer = map.createLayer("background", tilesetBlue!, 0, 0);
        this.worldLayer = map.createLayer("world", tileset!, 0, 0)!;
        this.worldLayer.setCollisionByExclusion([-1]);

        // Configura tiles que podem ser atravessados (se houver propriedade 'through')
        this.worldLayer.forEachTile((tile) => {
            if (tile.properties.through) {
                tile.setCollision(false, false, true, false);
                tile.alpha = 1;
                tile.visible = true;
            }
        });

        if (bgLayer) {
            bgLayer.setDepth(-2);
            bgLayer.setAlpha(1);
        }

        // --- 3. SPAWN DO PLAYER ---
        const spawnPoint = map.findObject("player", (obj) => {
            return obj.name === "PlayerSpawn";
        });

        // Fallback caso não encontre o ponto de spawn no mapa
        const startX = spawnPoint?.x || 100;
        const startY = spawnPoint?.y || 300;

        this.player = this.physics.add.sprite(startX, startY, "player_idle");

        this.player.body?.setSize(18, 25);
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.worldLayer!);

        this.player.setDepth(2);

        // --- 4. CÂMERA ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels,
        );

        // Zoom automático baseado no tamanho da janela
        const mapHeight = map.heightInPixels;
        const mapWidth = map.widthInPixels;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const zoomX = windowWidth / mapWidth;
        const zoomY = windowHeight / mapHeight;
        this.cameras.main.setZoom(Math.max(zoomX, zoomY));

        // --- 5. SONS ---
        this.jumpSound = this.sound.add("jump_sfx", { volume: 0.5 });
        this.fallSound = this.sound.add("fall_sfx", { volume: 0.5 });
        this.collectSound = this.sound.add("pickup_sfx", { volume: 0.4 });
        this.stepSound = this.sound.add("step_sfx", { volume: 0.3 });
        this.slideSound = this.sound.add("slide_sfx", {
            volume: 0.2,
            loop: false,
        });

        this.bgMusic = this.sound.add("theme_music", {
            volume: 0.1,
            loop: true,
        });

        if (!this.sound.locked) {
            this.bgMusic.play();
        } else {
            this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
                this.bgMusic.play();
            });
        }

        // --- 6. ANIMAÇÕES ---
        this.anims.create({
            key: "strawberry_idle",
            frames: this.anims.generateFrameNumbers("strawberry", {
                start: 0,
                end: 16,
            }),
            frameRate: 20,
            repeat: -1,
        });

        this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player_idle", {
                start: 0,
                end: 10,
            }),
            frameRate: 20,
            repeat: -1,
        });

        this.anims.create({
            key: "run",
            frames: this.anims.generateFrameNumbers("player_run", {
                start: 0,
                end: 11,
            }),
            frameRate: 20,
            repeat: -1,
        });

        this.anims.create({
            key: "jump",
            frames: [{ key: "player_jump", frame: 0 }],
            frameRate: 20,
        });

        this.anims.create({
            key: "fall",
            frames: [{ key: "player_fall", frame: 0 }],
            frameRate: 20,
        });

        this.anims.create({
            key: "wall_jump",
            frames: [{ key: "player_wall_jump", frame: 0 }],
            frameRate: 20,
        });

        this.anims.create({
            key: "double_jump",
            frames: this.anims.generateFrameNumbers("player_double_jump", {
                start: 0,
                end: 5, // Ajustado para não estourar frames se o spritesheet for menor
            }),
            frameRate: 20,
            repeat: 0,
        });

        this.anims.create({
            key: "collected",
            frames: this.anims.generateFrameNumbers("collected", {
                start: 0,
                end: 6,
            }),
            frameRate: 20,
            repeat: 0,
        });

        // --- 7. COLECIONÁVEIS ---
        const fruits = this.physics.add.group({ allowGravity: false });
        const fruitPoints = map.filterObjects(
            "collectibles",
            (obj) => obj.name !== "Strawberry",
        );

        fruitPoints?.forEach((point) => {
            const f = fruits.create(point.x, point.y, "strawberry");
            f.play("strawberry_idle");
            f.body?.setSize(14, 14);
            f.body?.setOffset(9, 9);
        });

        this.physics.add.overlap(this.player, fruits, (_p, f) => {
            const fruit = f as Phaser.Physics.Arcade.Sprite;
            if (fruit.body) fruit.body.enable = false;

            this.collectSound.play();

            fruit.play("collected");
            fruit.on("animationcomplete", () => {
                fruit.destroy();
            });
        });

        // --- 8. PARTÍCULAS ---
        this.dustEmitter = this.add.particles(0, 0, "dust", {
            lifespan: 300,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.6, end: 0 },
            speedY: { min: -20, max: -5 },
            speedX: { min: -5, max: 5 },
            frequency: -1, // Emissão manual
            blendMode: "NORMAL",
        });

        this.dustEmitter.startFollow(this.player);
        this.dustEmitter.setDepth(1);
    }

    update() {
        const speed = 160;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = playerBody.blocked.down;

        if (isGrounded) {
            this.canDoubleJump = true;
        }

        // --- 1. MOVIMENTO HORIZONTAL ---
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        // --- 2. PULO, PULO DUPLO E WALL JUMP ---
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            const isTouchingWallForJump =
                (playerBody.blocked.left || playerBody.blocked.right) &&
                !isGrounded;

            if (isGrounded) {
                this.player.setVelocityY(-260);
                this.jumpSound.play();

                this.dustEmitter.speedX = { min: -30, max: 30 };
                this.dustEmitter.speedY = { min: -10, max: 0 };
                this.dustEmitter.followOffset.set(0, 12);
                this.dustEmitter.explode(8);
            } else if (isTouchingWallForJump) {
                const jumpDirection = playerBody.blocked.left ? 1 : -1;

                this.player.setVelocityX(speed * 1.5 * jumpDirection);
                this.player.setVelocityY(-260);

                this.player.setFlipX(jumpDirection === -1);
                this.jumpSound.play();
                this.canDoubleJump = true;

                this.dustEmitter.speedX = { min: -20, max: 20 };
                this.dustEmitter.explode(4);
            } else if (this.canDoubleJump) {
                this.player.setVelocityY(-230);
                this.canDoubleJump = false;
                this.jumpSound.play({ detune: 200 });
                this.player.play("double_jump", true);

                this.dustEmitter.speedX = { min: -15, max: 15 };
                this.dustEmitter.speedY = { min: 0, max: 10 };
                this.dustEmitter.followOffset.set(0, 12);
                this.dustEmitter.explode(5);
            }
        }

        // --- 3. LÓGICA DE WALL SLIDE ---
        const isTouchingWall =
            (playerBody.blocked.left || playerBody.blocked.right) &&
            !isGrounded;

        const isFalling = playerBody.velocity.y > 0;
        let isWallSliding = false;

        if (isTouchingWall && isFalling) {
            // Desliza devagar
            this.player.setVelocityY(50);
            isWallSliding = true;

            // Som de deslize
            this.wallSlideTimer++;
            if (this.wallSlideTimer >= 15) {
                this.slideSound.play({
                    volume: 0.2,
                    detune: Phaser.Math.Between(-50, 50),
                });
                this.wallSlideTimer = 0;
            }
        } else {
            this.wallSlideTimer = 10; // Reset para o som tocar rápido na próxima vez
        }

        // --- 4. CONTROLE DAS ANIMAÇÕES ---
        const isDoubleJumping =
            this.player.anims.currentAnim?.key === "double_jump" &&
            this.player.anims.isPlaying;

        if (isWallSliding) {
            this.player.anims.play("wall_jump", true);
            // Ajusta o flip visual para parecer que está de costas para a parede
            if (playerBody.blocked.left) this.player.setFlipX(true);
            if (playerBody.blocked.right) this.player.setFlipX(false);
        } else if (!isGrounded) {
            if (!isDoubleJumping) {
                if (playerBody.velocity.y < 0) {
                    this.player.anims.play("jump", true);
                } else {
                    this.player.anims.play("fall", true);
                }
            }
        } else {
            // No chão
            if (playerBody.velocity.x !== 0) {
                this.player.anims.play("run", true);
            } else {
                this.player.anims.play("idle", true);
            }
        }

        // --- 5. PARTÍCULAS E SONS DE PASSOS ---
        if (isGrounded && this.wasInAir) {
            // Impacto no chão
            this.dustEmitter.speedX = { min: -50, max: 50 };
            this.dustEmitter.speedY = { min: -20, max: 0 };
            this.dustEmitter.followOffset.set(-15, 12);
            this.dustEmitter.explode(10);
            this.dustEmitter.followOffset.set(15, 12);
            this.dustEmitter.explode(10);
            this.fallSound.play();
        }

        const isRunningFast = Math.abs(playerBody.velocity.x) > 10;

        if (isGrounded && isRunningFast) {
            this.dustEmitter.speedX = { min: -5, max: 5 };
            this.dustEmitter.speedY = { min: -20, max: -5 };
            const xOffset = this.player.flipX ? 8 : -8;
            this.dustEmitter.followOffset.set(xOffset, 12);

            this.dustTimer++;
            if (this.dustTimer >= 6) {
                this.dustEmitter.emitParticle(1);
                this.dustTimer = 0;
            }

            this.stepTimer++;
            if (this.stepTimer >= 20) {
                this.stepSound.play({
                    volume: 0.3,
                    detune: Phaser.Math.Between(-100, 100),
                });
                this.stepTimer = 0;
            }
        } else {
            this.dustTimer = 0;
            this.stepTimer = 15;
        }

        this.wasInAir = !isGrounded;
    }
}

