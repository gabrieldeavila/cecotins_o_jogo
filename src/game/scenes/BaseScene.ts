import Phaser, { Scene } from "phaser";
import { GameInputContextData } from "../../context/game";

/**
 * Interface para definir as configurações de cada fase.
 */
export interface LevelConfig {
    mapId: string;
    tileSetTerrain: string;
    tileSetBackground: string;
    bgMusicKey: string;
    blueTileKey?: string;
    parallaxLayers?: { name: string; speed: number }[];
}

export abstract class BaseScene extends Scene {
    // Referências do Player
    protected player: Phaser.Physics.Arcade.Sprite;
    protected cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    protected keys: any;

    // Camadas e Mapa
    protected map: Phaser.Tilemaps.Tilemap;
    protected worldLayer: Phaser.Tilemaps.TilemapLayer;
    protected backgroundLayers: Phaser.Tilemaps.TilemapLayer[] = [];

    // Fundo Infinito
    protected skyBackground: Phaser.GameObjects.TileSprite;

    // Estado do Personagem
    protected wasInAir: boolean = false;
    protected canDoubleJump: boolean = false;
    protected stepTimer: number = 0;
    protected wallSlideTimer: number = 0;
    protected dustTimer: number = 0;

    // Efeitos, Itens e Mobs
    protected dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    protected collectiblesGroup: Phaser.Physics.Arcade.Group;
    protected mobsGroup: Phaser.Physics.Arcade.Group;
    protected finishPoint: Phaser.Physics.Arcade.Sprite;

    // Áudio
    protected sounds: { [key: string]: Phaser.Sound.BaseSound } = {};
    protected bgMusic: Phaser.Sound.BaseSound;

    // Contexto Mobile
    protected mobileControlsRef: GameInputContextData["controlsRef"];

    constructor(key: string) {
        super(key);
    }

    abstract getLevelConfig(): LevelConfig;

    create() {
        const config = this.getLevelConfig();
        this.mobileControlsRef = this.registry.get("controlsRef");

        this.createGlobalAnimations();
        this.setupMap(config);
        this.setupControls();
        this.setupPlayerAndFinish();

        // Setup de grupos antes da física
        this.mobsGroup = this.physics.add.group({
            collideWorldBounds: true,
            bounceX: 0,
            bounceY: 0,
        });

        this.collectiblesGroup = this.physics.add.group({
            allowGravity: false,
        });

        this.createMobs(this.map);
        this.createCollectibles(this.map);

        this.setupPhysics();
        this.setupAudio(config);
        this.setupParticles();
        this.setupCamera();

        this.afterCreate();
    }

    private setupMap(config: LevelConfig) {
        this.map = this.make.tilemap({ key: config.mapId });
        const tileset = this.map.addTilesetImage(
            "terrain",
            config.tileSetTerrain,
        );
        const bgKey = config.blueTileKey || config.tileSetBackground;
        const tilesetBlue = this.map.addTilesetImage("Blue back", bgKey);

        const width = this.scale.width;
        const height = this.scale.height;

        this.skyBackground = this.add.tileSprite(0, 0, width, height, bgKey);
        this.skyBackground.setOrigin(0, 0);
        this.skyBackground.setScrollFactor(0);
        this.skyBackground.setDepth(-100);

        if (config.parallaxLayers) {
            config.parallaxLayers.forEach((layerData, index) => {
                const layer = this.map.createLayer(
                    layerData.name,
                    tilesetBlue!,
                    0,
                    0,
                );
                if (layer) {
                    layer.setDepth(-50 + index);
                    layer.setScrollFactor(layerData.speed);
                    this.backgroundLayers.push(layer);
                }
            });
        }

        this.worldLayer = this.map.createLayer("world", tileset!, 0, 0)!;
        this.worldLayer.setCollisionByExclusion([-1]);
        this.worldLayer.setDepth(0);

        this.worldLayer.forEachTile((tile) => {
            if (tile.properties.through) {
                tile.setCollision(false, false, true, false);
            }
        });
    }

    protected setupPhysics() {
        if (this.player && this.worldLayer) {
            this.physics.add.collider(this.player, this.worldLayer);
        }

        if (this.finishPoint && this.worldLayer) {
            this.physics.add.collider(this.finishPoint, this.worldLayer);
        }

        if (this.mobsGroup && this.worldLayer) {
            this.physics.add.collider(this.mobsGroup, this.worldLayer);

            this.physics.add.overlap(this.player, this.mobsGroup, () => {
                this.onPlayerDeath();
            });
        }
    }

    private setupPlayerAndFinish() {
        const playerLayer = this.map.getObjectLayer("player");
        const spawnPoint = playerLayer?.objects.find(
            (obj) => obj.name === "PlayerSpawn",
        );
        const finishData = playerLayer?.objects.find(
            (obj) => obj.name === "Finish",
        );

        this.player = this.physics.add.sprite(
            spawnPoint?.x || 100,
            spawnPoint?.y || 300,
            "player_idle",
        );
        this.player.body?.setSize(18, 25);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(2);

        if (finishData) {
            this.finishPoint = this.physics.add.sprite(
                finishData.x!,
                finishData.y!,
                "finish",
            );
            this.finishPoint.setScale(0.5);
            this.finishPoint.setOrigin(0.5, 1);
            this.finishPoint.setDepth(1);
            this.finishPoint.setVisible(false);

            if (this.finishPoint.body) {
                const body = this.finishPoint
                    .body as Phaser.Physics.Arcade.Body;
                body.enable = false;
                body.setSize(44, 46);
                body.setOffset(10, 18);
                body.setImmovable(true);
                this.finishPoint.setCollideWorldBounds(true);
            }

            this.physics.add.overlap(this.player, this.finishPoint, () => {
                this.onLevelComplete();
            });
        }
    }

    private createMobs(map: Phaser.Tilemaps.Tilemap) {
        const enemyLayer = map.getObjectLayer("enemies");

        enemyLayer?.objects.forEach((obj) => {
            const initialTexture = this.textures.exists("crab_idle_1")
                ? "crab_idle_1"
                : "player_idle";

            const mob = this.mobsGroup.create(
                obj.x,
                obj.y,
                initialTexture,
            ) as Phaser.Physics.Arcade.Sprite;

            mob.setOrigin(0.5, 1);

            // Hitbox do caranguejo
            const bodyWidth = 30;
            const bodyHeight = 22;

            if (mob.body) {
                const body = mob.body as Phaser.Physics.Arcade.Body;
                body.setSize(bodyWidth, bodyHeight);

                // AJUSTE PARA NÃO VOAR: Offset Y aumentado para baixar o sprite
                const offsetX = (mob.width - bodyWidth) / 2;
                const offsetY = mob.height - bodyHeight - 8;
                body.setOffset(offsetX, offsetY);
                body.setGravityY(800);
            }

            // Estados iniciais
            mob.setData("state", "run");
            mob.setData("direction", -1);
            mob.setVelocityX(-60);

            if (this.anims.exists("crab_run")) {
                mob.play("crab_run");
            }
        });
    }

    update() {
        if (!this.player || !this.player.body) return;

        this.handleMovement();
        this.handleAnimations();
        this.handleGroundEffects();
        this.handleMobsAI();

        if (this.skyBackground) {
            this.skyBackground.tilePositionX = this.cameras.main.scrollX * 0.1;
            this.skyBackground.tilePositionY = this.cameras.main.scrollY * 0.1;
        }

        if (this.finishPoint && this.finishPoint.body) {
            const finishBody = this.finishPoint
                .body as Phaser.Physics.Arcade.Body;
            if (finishBody.blocked.down) {
                finishBody.setAllowGravity(false);
                finishBody.setVelocity(0, 0);
            }
        }
    }

    protected handleMobsAI() {
        this.mobsGroup.children.entries.forEach((m) => {
            const mob = m as Phaser.Physics.Arcade.Sprite;
            const body = mob.body as Phaser.Physics.Arcade.Body;
            if (!body) return;

            const state = mob.getData("state");
            let direction = mob.getData("direction");

            if (state === "idle") {
                // Estado parado
                mob.setVelocityX(0);
                const idleTimer = mob.getData("idleTimer");

                if (this.time.now > idleTimer) {
                    // Acabou o tempo de espera, volta a correr
                    mob.setData("state", "run");
                    mob.setVelocityX(60 * direction);
                    if (this.anims.exists("crab_run")) {
                        mob.play("crab_run", true);
                    }
                }
            } else {
                // Estado correndo
                const isBlocked =
                    (direction === -1 && body.blocked.left) ||
                    (direction === 1 && body.blocked.right);

                const checkX = direction === 1 ? mob.x + 14 : mob.x - 14;
                const checkY = mob.y + 4;
                const nextTile = this.worldLayer.getTileAtWorldXY(
                    checkX,
                    checkY,
                );
                const isNearEdge = !nextTile && body.blocked.down;

                if (isBlocked || isNearEdge) {
                    // Bateu em algo ou chegou na borda: Entra em IDLE por 2 segundos
                    mob.setData("state", "idle");
                    mob.setData("idleTimer", this.time.now + 2000);

                    // Inverte a direção para a próxima vez que correr
                    direction *= -1;
                    mob.setData("direction", direction);

                    mob.setVelocityX(0);
                    if (this.anims.exists("crab_idle")) {
                        mob.play("crab_idle", true);
                    }
                } else {
                    // Mantém a velocidade de corrida
                    mob.setVelocityX(60 * direction);
                }
            }

            // Atualiza o flip visual baseado na direção pretendida
            mob.setFlipX(direction === 1);
        });
    }

    protected onPlayerDeath() {
        console.log("Player morreu!");
        this.sounds.fall?.play();
        this.cameras.main.shake(200, 0.01);

        this.player.setTint(0xff0000);
        this.physics.pause();

        this.time.delayedCall(500, () => {
            this.scene.restart();
        });
    }

    protected onLevelComplete() {
        console.log("Fase concluída!");
        this.player.setVelocity(0);
        if (this.player.body) {
            this.player.body.enable = false;
        }
    }

    protected afterCreate() {}

    private setupControls() {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = {
            w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            enter: this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.ENTER,
            ),
            space: this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE,
            ),
        };
    }

    private setupAudio(config: LevelConfig) {
        this.sounds.jump = this.sound.add("jump_sfx", { volume: 0.5 });
        this.sounds.fall = this.sound.add("fall_sfx", { volume: 0.5 });
        this.sounds.collect = this.sound.add("pickup_sfx", { volume: 0.4 });
        this.sounds.step = this.sound.add("step_sfx", { volume: 0.3 });
        this.sounds.slide = this.sound.add("slide_sfx", { volume: 0.2 });

        this.bgMusic = this.sound.add(config.bgMusicKey, {
            volume: 0.1,
            loop: true,
        });
        if (!this.sound.locked) this.bgMusic.play();
        else
            this.sound.once(Phaser.Sound.Events.UNLOCKED, () =>
                this.bgMusic.play(),
            );
    }

    private setupParticles() {
        this.dustEmitter = this.add.particles(0, 0, "dust", {
            lifespan: 300,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.6, end: 0 },
            speedY: { min: -20, max: -5 },
            speedX: { min: -5, max: 5 },
            frequency: -1,
        });
        this.dustEmitter.startFollow(this.player);
        this.dustEmitter.setDepth(1);
    }

    private setupCamera() {
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(
            0,
            0,
            this.map.widthInPixels,
            this.map.heightInPixels,
        );
        const zoom = Math.max(
            window.innerWidth / this.map.widthInPixels,
            window.innerHeight / this.map.heightInPixels,
        );
        this.cameras.main.setZoom(zoom);
    }

    protected handleMovement() {
        const speed = 160;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = playerBody.blocked.down;
        if (isGrounded) this.canDoubleJump = true;
        const isMovingLeft =
            this.keys.a.isDown ||
            this.cursors.left.isDown ||
            this.mobileControlsRef.current.left;
        const isMovingRight =
            this.keys.d.isDown ||
            this.cursors.right.isDown ||
            this.mobileControlsRef.current.right;
        if (isMovingLeft) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (isMovingRight) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }
        const jumpJustPressed =
            Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
            Phaser.Input.Keyboard.JustDown(this.keys.w) ||
            Phaser.Input.Keyboard.JustDown(this.keys.space) ||
            Phaser.Input.Keyboard.JustDown(this.keys.enter) ||
            this.mobileControlsRef.current.jump;
        if (jumpJustPressed) {
            this.performJump();
            if (this.mobileControlsRef.current.jump)
                this.mobileControlsRef.current.jump = false;
        }
    }

    private performJump() {
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        if (playerBody.blocked.down) {
            this.player.setVelocityY(-260);
            this.sounds.jump.play();
            this.explodeDust(8);
        } else if (playerBody.blocked.left || playerBody.blocked.right) {
            const dir = playerBody.blocked.left ? 1 : -1;
            this.player.setVelocityX(240 * dir);
            this.player.setVelocityY(-260);
            this.player.setFlipX(dir === -1);
            this.sounds.jump.play();
            this.canDoubleJump = true;
        } else if (this.canDoubleJump) {
            this.player.setVelocityY(-230);
            this.canDoubleJump = false;
            this.player.play("double_jump", true);
            this.sounds.jump.play({ detune: 200 });
            this.explodeDust(6);
        }
    }

    protected handleAnimations() {
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = playerBody.blocked.down;
        const isFalling = playerBody.velocity.y > 0;
        const isTouchingWall =
            (playerBody.blocked.left || playerBody.blocked.right) &&
            !isGrounded;
        let isWallSliding = false;
        if (isTouchingWall && isFalling) {
            this.player.setVelocityY(50);
            isWallSliding = true;
            this.wallSlideTimer++;
            if (this.wallSlideTimer >= 15) {
                this.sounds.slide.play({
                    volume: 0.2,
                    detune: Phaser.Math.Between(-50, 50),
                });
                this.wallSlideTimer = 0;
            }
        } else {
            this.wallSlideTimer = 10;
        }
        const isDoubleJumping =
            this.player.anims.currentAnim?.key === "double_jump" &&
            this.player.anims.isPlaying;
        if (isWallSliding) {
            this.player.anims.play("wall_jump", true);
            if (playerBody.blocked.left) this.player.setFlipX(true);
            if (playerBody.blocked.right) this.player.setFlipX(false);
        } else if (!isGrounded) {
            if (!isDoubleJumping) {
                if (playerBody.velocity.y < 0)
                    this.player.anims.play("jump", true);
                else this.player.anims.play("fall", true);
            }
        } else {
            if (playerBody.velocity.x !== 0)
                this.player.anims.play("run", true);
            else this.player.anims.play("idle", true);
        }
    }

    protected handleGroundEffects() {
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = playerBody.blocked.down;
        if (isGrounded && this.wasInAir) {
            this.dustEmitter.followOffset.set(-15, 12);
            this.dustEmitter.explode(10);
            this.dustEmitter.followOffset.set(15, 12);
            this.dustEmitter.explode(10);
            this.sounds.fall.play();
        }
        const isRunningFast = Math.abs(playerBody.velocity.x) > 10;
        if (isGrounded && isRunningFast) {
            const xOffset = this.player.flipX ? 8 : -8;
            this.dustEmitter.followOffset.set(xOffset, 12);
            this.dustTimer++;
            if (this.dustTimer >= 6) {
                this.dustEmitter.emitParticle(1);
                this.dustTimer = 0;
            }
            this.stepTimer++;
            if (this.stepTimer >= 20) {
                this.sounds.step.play({
                    volume: 0.3,
                    detune: Phaser.Math.Between(-100, 100),
                });
                this.stepTimer = 0;
            }
        }
        this.wasInAir = !isGrounded;
    }

    protected explodeDust(count: number) {
        this.dustEmitter.followOffset.set(0, 12);
        this.dustEmitter.explode(count);
    }

    private createGlobalAnimations() {
        if (this.anims.exists("idle")) return;

        // Animação Idle (Individual PNGs)
        const crabIdleFrames = [];
        for (let i = 1; i <= 9; i++) {
            const key = `crab_idle_${i}`;
            if (this.textures.exists(key)) crabIdleFrames.push({ key });
        }
        if (crabIdleFrames.length > 0)
            this.anims.create({
                key: "crab_idle",
                frames: crabIdleFrames,
                frameRate: 10,
                repeat: -1,
            });

        // Animação Run (Individual PNGs) - ADICIONADO AGORA
        const crabRunFrames = [];
        for (let i = 1; i <= 6; i++) {
            const key = `crab_run_${i}`;
            if (this.textures.exists(key)) crabRunFrames.push({ key });
        }
        if (crabRunFrames.length > 0)
            this.anims.create({
                key: "crab_run",
                frames: crabRunFrames,
                frameRate: 12,
                repeat: -1,
            });

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
            key: "finish_idle",
            frames: this.anims.generateFrameNumbers("finish", {
                start: 0,
                end: 7,
            }),
            frameRate: 15,
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
                end: 5,
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
    }

    private createCollectibles(map: Phaser.Tilemaps.Tilemap) {
        const fruitPoints = map.filterObjects(
            "collectibles",
            (obj) => obj.name !== "Strawberry",
        );
        fruitPoints?.forEach((point) => {
            const f = this.collectiblesGroup.create(
                point.x,
                point.y,
                "strawberry",
            );
            f.play("strawberry_idle");
            f.body?.setSize(14, 14);
            f.body?.setOffset(9, 9);
        });
        if (this.collectiblesGroup.countActive(true) === 0)
            this.activateFinish();
        this.physics.add.overlap(
            this.player,
            this.collectiblesGroup,
            (_p, f) => {
                const fruit = f as Phaser.Physics.Arcade.Sprite;
                if (fruit.body) fruit.body.enable = false;
                this.sounds.collect.play();
                fruit.play("collected");
                fruit.on("animationcomplete", () => {
                    fruit.destroy();
                    if (this.collectiblesGroup.countActive(true) === 0)
                        this.activateFinish();
                });
            },
        );
    }

    private activateFinish() {
        if (this.finishPoint && this.finishPoint.body) {
            this.finishPoint.setVisible(true);
            this.finishPoint.body.enable = true;
            this.finishPoint.setAlpha(0);
            this.tweens.add({
                targets: this.finishPoint,
                alpha: 1,
                duration: 500,
                ease: "Power2",
            });
            this.finishPoint.play("finish_idle");
        }
    }
}

