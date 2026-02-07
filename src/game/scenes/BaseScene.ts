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
    // Parallax para camadas do Tiled (opcional)
    // Ex: [{ name: 'Nuvens', speed: 0.3 }, { name: 'Montanhas', speed: 0.5 }]
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
    
    // Fundo Infinito (Parallax do Céu)
    protected skyBackground: Phaser.GameObjects.TileSprite;
    
    // Estado do Personagem
    protected wasInAir: boolean = false;
    protected canDoubleJump: boolean = false;
    protected stepTimer: number = 0;
    protected wallSlideTimer: number = 0;
    protected dustTimer: number = 0;

    // Efeitos e Itens
    protected dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    protected collectiblesGroup: Phaser.Physics.Arcade.Group;
    protected finishPoint: Phaser.Physics.Arcade.Sprite;
    
    // Áudio
    protected sounds: { [key: string]: Phaser.Sound.BaseSound } = {};
    protected bgMusic: Phaser.Sound.BaseSound;

    // Contexto Mobile
    protected mobileControlsRef: GameInputContextData["controlsRef"];

    constructor(key: string) {
        super(key);
    }

    /**
     * Método abstrato: Cada fase deve retornar suas configurações únicas
     */
    abstract getLevelConfig(): LevelConfig;

    create() {
        const config = this.getLevelConfig();
        this.mobileControlsRef = this.registry.get("controlsRef");

        // 1. Criar animações globais
        this.createGlobalAnimations();

        // 2. Setup básico e Mapa
        this.setupMap(config);
        
        // 3. Setup de Controles
        this.setupControls();
        
        // 4. Criar o Player e o Finish (Troféu)
        this.setupPlayerAndFinish();
        
        // 5. Setup de física e itens
        this.setupPhysics();
        this.createCollectibles(this.map);
        
        // 6. Restante dos sistemas
        this.setupAudio(config);
        this.setupParticles();
        this.setupCamera();
        
        this.afterCreate();
    }

    private setupMap(config: LevelConfig) {
        this.map = this.make.tilemap({ key: config.mapId });
        const tileset = this.map.addTilesetImage("terrain", config.tileSetTerrain);
        
        // Usamos a chave de fundo definida na config (geralmente 'blue-img')
        const bgKey = config.blueTileKey || config.tileSetBackground;
        const tilesetBlue = this.map.addTilesetImage("Blue back", bgKey);

        // --- BACKGROUND INFINITO (Céu/Fundo fixo que repete) ---
        // Pegamos o tamanho da tela para o TileSprite preencher tudo
        const width = this.scale.width;
        const height = this.scale.height;
        
        this.skyBackground = this.add.tileSprite(0, 0, width, height, bgKey);
        this.skyBackground.setOrigin(0, 0);
        this.skyBackground.setScrollFactor(0); // Fica preso na câmera
        this.skyBackground.setDepth(-100);    // Fica atrás de tudo
        
        // --- CAMADAS DE PARALLAX DO TILED ---
        if (config.parallaxLayers && config.parallaxLayers.length > 0) {
            config.parallaxLayers.forEach((layerData, index) => {
                const layer = this.map.createLayer(layerData.name, tilesetBlue!, 0, 0);
                if (layer) {
                    layer.setDepth(-50 + index);
                    // Define a velocidade de movimento em relação à câmera
                    layer.setScrollFactor(layerData.speed);
                    this.backgroundLayers.push(layer);
                }
            });
        }

        // Camada principal do mundo (Chão/Paredes)
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
    }

    private setupPlayerAndFinish() {
        const playerLayer = this.map.getObjectLayer("player");
        
        if (!playerLayer) {
            console.warn("Camada de objetos 'player' não encontrada!");
        }

        const spawnPoint = playerLayer?.objects.find(obj => obj.name === "PlayerSpawn");
        const finishData = playerLayer?.objects.find(obj => obj.name === "Finish");

        // Setup Player
        this.player = this.physics.add.sprite(spawnPoint?.x || 100, spawnPoint?.y || 300, "player_idle");
        this.player.body?.setSize(18, 25);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(2);

        // Setup Finish (Troféu)
        if (finishData) {
            this.finishPoint = this.physics.add.sprite(finishData.x!, finishData.y!, "finish");
            this.finishPoint.setScale(0.5); // Escala reduzida para ficar proporcional
            this.finishPoint.setOrigin(0.5, 1); 
            this.finishPoint.setDepth(1);
            this.finishPoint.setVisible(false);
            
            if (this.finishPoint.body) {
                const body = this.finishPoint.body as Phaser.Physics.Arcade.Body;
                body.enable = false;
                
                // Hitbox ajustado para o sprite de 64x64 original
                body.setSize(44, 46); 
                body.setOffset(10, 18); 
                
                body.setBounce(0, 0);
                body.setFriction(1, 1);
                body.setImmovable(true); 
                this.finishPoint.setCollideWorldBounds(true);
            }
            
            this.physics.add.overlap(this.player, this.finishPoint, () => {
                this.onLevelComplete();
            });
        }
    }

    private setupControls() {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = {
            w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            enter: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
            space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        };
    }

    private setupAudio(config: LevelConfig) {
        this.sounds.jump = this.sound.add("jump_sfx", { volume: 0.5 });
        this.sounds.fall = this.sound.add("fall_sfx", { volume: 0.5 });
        this.sounds.collect = this.sound.add("pickup_sfx", { volume: 0.4 });
        this.sounds.step = this.sound.add("step_sfx", { volume: 0.3 });
        this.sounds.slide = this.sound.add("slide_sfx", { volume: 0.2 });
        
        this.bgMusic = this.sound.add(config.bgMusicKey, { volume: 0.1, loop: true });
        if (!this.sound.locked) this.bgMusic.play();
        else this.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.bgMusic.play());
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
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        
        const zoom = Math.max(window.innerWidth / this.map.widthInPixels, window.innerHeight / this.map.heightInPixels);
        this.cameras.main.setZoom(zoom);
    }

    update() {
        if (!this.player || !this.player.body) return;
        
        this.handleMovement();
        this.handleAnimations();
        this.handleGroundEffects();
        
        // --- ATUALIZAÇÃO DO PARALLAX DO CÉU ---
        if (this.skyBackground) {
            // Movemos a textura internamente para criar o efeito de parallax infinito
            this.skyBackground.tilePositionX = this.cameras.main.scrollX * 0.1;
            this.skyBackground.tilePositionY = this.cameras.main.scrollY * 0.1;
        }

        // Estabiliza o troféu no chão
        if (this.finishPoint && this.finishPoint.body) {
            const finishBody = this.finishPoint.body as Phaser.Physics.Arcade.Body;
            if (finishBody.blocked.down) {
                finishBody.setAllowGravity(false);
                finishBody.setVelocity(0, 0);
            }
        }
    }

    protected handleMovement() {
        const speed = 160;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = playerBody.blocked.down;

        if (isGrounded) this.canDoubleJump = true;

        const isMovingLeft = this.keys.a.isDown || this.cursors.left.isDown || this.mobileControlsRef.current.left;
        const isMovingRight = this.keys.d.isDown || this.cursors.right.isDown || this.mobileControlsRef.current.right;

        if (isMovingLeft) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (isMovingRight) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        const jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || 
                               Phaser.Input.Keyboard.JustDown(this.keys.w) || 
                               Phaser.Input.Keyboard.JustDown(this.keys.space) || 
                               Phaser.Input.Keyboard.JustDown(this.keys.enter) ||
                               this.mobileControlsRef.current.jump;

        if (jumpJustPressed) {
            this.performJump();
            if (this.mobileControlsRef.current.jump) this.mobileControlsRef.current.jump = false;
        }
    }

    private performJump() {
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        if (playerBody.blocked.down) {
            this.player.setVelocityY(-260);
            this.sounds.jump.play();
            this.explodeDust(8);
        } else if ((playerBody.blocked.left || playerBody.blocked.right)) {
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
        const isTouchingWall = (playerBody.blocked.left || playerBody.blocked.right) && !isGrounded;

        let isWallSliding = false;

        if (isTouchingWall && isFalling) {
            this.player.setVelocityY(50);
            isWallSliding = true;
            this.wallSlideTimer++;
            if (this.wallSlideTimer >= 15) {
                this.sounds.slide.play({ volume: 0.2, detune: Phaser.Math.Between(-50, 50) });
                this.wallSlideTimer = 0;
            }
        } else {
            this.wallSlideTimer = 10;
        }

        const isDoubleJumping = this.player.anims.currentAnim?.key === "double_jump" && this.player.anims.isPlaying;

        if (isWallSliding) {
            this.player.anims.play("wall_jump", true);
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
            if (playerBody.velocity.x !== 0) {
                this.player.anims.play("run", true);
            } else {
                this.player.anims.play("idle", true);
            }
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
                this.sounds.step.play({ volume: 0.3, detune: Phaser.Math.Between(-100, 100) });
                this.stepTimer = 0;
            }
        }

        this.wasInAir = !isGrounded;
    }

    protected explodeDust(count: number) {
        this.dustEmitter.followOffset.set(0, 12);
        this.dustEmitter.explode(count);
    }

    protected onLevelComplete() {
        console.log("Fase concluída!");
        this.player.setVelocity(0);
        if (this.player.body) {
            this.player.body.enable = false;
        }
    }

    protected afterCreate() {}
    
    private createGlobalAnimations() {
        if (this.anims.exists('idle')) return; 

        this.anims.create({
            key: "strawberry_idle",
            frames: this.anims.generateFrameNumbers("strawberry", { start: 0, end: 16 }),
            frameRate: 20,
            repeat: -1,
        });

        this.anims.create({
            key: "finish_idle",
            frames: this.anims.generateFrameNumbers("finish", { start: 0, end: 7 }),
            frameRate: 15,
            repeat: -1,
        });

        this.anims.create({
            key: "idle",
            frames: this.anims.generateFrameNumbers("player_idle", { start: 0, end: 10 }),
            frameRate: 20,
            repeat: -1,
        });
        this.anims.create({
            key: "run",
            frames: this.anims.generateFrameNumbers("player_run", { start: 0, end: 11 }),
            frameRate: 20,
            repeat: -1,
        });
        this.anims.create({ key: "jump", frames: [{ key: "player_jump", frame: 0 }], frameRate: 20 });
        this.anims.create({ key: "fall", frames: [{ key: "player_fall", frame: 0 }], frameRate: 20 });
        this.anims.create({ key: "wall_jump", frames: [{ key: "player_wall_jump", frame: 0 }], frameRate: 20 });
        this.anims.create({
            key: "double_jump",
            frames: this.anims.generateFrameNumbers("player_double_jump", { start: 0, end: 5 }),
            frameRate: 20,
            repeat: 0,
        });
        this.anims.create({
            key: "collected",
            frames: this.anims.generateFrameNumbers("collected", { start: 0, end: 6 }),
            frameRate: 20,
            repeat: 0,
        });
    }

    private createCollectibles(map: Phaser.Tilemaps.Tilemap) {
        this.collectiblesGroup = this.physics.add.group({ allowGravity: false });
        const fruitPoints = map.filterObjects("collectibles", (obj) => obj.name !== "Strawberry");

        fruitPoints?.forEach((point) => {
            const f = this.collectiblesGroup.create(point.x, point.y, "strawberry");
            f.play("strawberry_idle"); 
            f.body?.setSize(14, 14);
            f.body?.setOffset(9, 9);
        });

        if (this.collectiblesGroup.countActive(true) === 0) {
            this.activateFinish();
        }

        this.physics.add.overlap(this.player, this.collectiblesGroup, (_p, f) => {
            const fruit = f as Phaser.Physics.Arcade.Sprite;
            if (fruit.body) fruit.body.enable = false;
            this.sounds.collect.play();
            fruit.play("collected");
            
            fruit.on("animationcomplete", () => {
                fruit.destroy();
                if (this.collectiblesGroup.countActive(true) === 0) {
                    this.activateFinish();
                }
            });
        });
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
                ease: 'Power2'
            });
            this.finishPoint.play("finish_idle");
        }
    }
}