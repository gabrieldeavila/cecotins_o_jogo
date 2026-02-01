import { Scene } from "phaser";

export class Game extends Scene {
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private worldLayer: Phaser.Tilemaps.TilemapLayer;
    private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private wasInAir: boolean = false;
    private dustTimer: number = 0;

    // 1. Variável de controle para o Pulo Duplo
    private canDoubleJump: boolean = false;

    constructor() {
        super("Game");
    }

    create() {
        // 1. Criar o Mapa
        const map = this.make.tilemap({ key: "mapa_fase1" });
        const tileset = map.addTilesetImage("terrain", "terrain-tiles");
        const tilesetBlue = map.addTilesetImage("Blue back", "blue-img");

        this.cursors = this.input.keyboard!.createCursorKeys();

        // 2. Criar as Camadas
        const bgLayer = map.createLayer("background", tilesetBlue!, 0, 0);
        this.worldLayer = map.createLayer("world", tileset!, 0, 0)!;
        this.worldLayer.setCollisionByExclusion([-1]);

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

        // 3. Spawn do Player
        const spawnPoint = map.findObject("player", (obj) => {
            return obj.name === "PlayerSpawn";
        });

        this.player = this.physics.add.sprite(
            spawnPoint!.x!,
            spawnPoint!.y!,
            "player_idle",
        );

        this.player.body?.setSize(18, 25);
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.worldLayer!);

        this.player.setDepth(2);

        // 4. Câmera
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels,
        );
        this.cameras.main.setZoom(2);

        // 5. Animações
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
            // frameRate aleatório ou repeat delay pode adicionar variedade, mas simples é bom
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
            frameRate: -1,
        });

        this.anims.create({
            key: "double_jump",
            frames: this.anims.generateFrameNumbers("player_double_jump", {
                start: 0,
                end: 6,
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

        // 6. Colecionáveis
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
            fruit.play("collected");
            fruit.on("animationcomplete", () => {
                fruit.destroy();
            });
        });

        // 7. CONFIGURAÇÃO DE PARTÍCULAS
        const dustParticles = this.add.particles(0, 0, "dust", {
            lifespan: 300,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.6, end: 0 },
            speedY: { min: -20, max: -5 },
            speedX: { min: -5, max: 5 },
            frequency: -1, // Manual
            blendMode: "NORMAL",
        });

        this.dustEmitter = dustParticles;
        this.dustEmitter.startFollow(this.player);
        this.dustEmitter.setDepth(1);
    }

    update() {
        const speed = 160;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = playerBody.blocked.down;

        // Resetar Double Jump ao tocar no chão
        if (isGrounded) {
            this.canDoubleJump = true;
        }

        // --- 1. MOVIMENTO (Física) ---
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        // --- 2. PULO E DOUBLE JUMP ---
        // Usamos JustDown para evitar pulo contínuo e controlar o pulo duplo
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            if (isGrounded) {
                // PULO NORMAL (Reduzido em ~25%)
                this.player.setVelocityY(-260);

                // Efeito Poeira Pulo
                this.dustEmitter.speedX = { min: -30, max: 30 };
                this.dustEmitter.speedY = { min: -10, max: 0 };
                this.dustEmitter.followOffset.set(0, 12);
                this.dustEmitter.explode(8);
            } else if (this.canDoubleJump) {
                // DOUBLE JUMP (Reduzido proporcionalmente)
                this.player.setVelocityY(-230);
                this.canDoubleJump = false; // Gasta o pulo duplo

                // Toca a animação aqui (será protegida na seção 4)
                this.player.play("double_jump", true);

                // Efeito sutil de poeira no ar (opcional)
                this.dustEmitter.speedX = { min: -15, max: 15 };
                this.dustEmitter.speedY = { min: 0, max: 10 };
                this.dustEmitter.followOffset.set(0, 12);
                this.dustEmitter.explode(5);
            }
        }

        // (Removi a lógica de pulo variável que estava aqui antes)

        // --- 3. LÓGICA DE PAREDE ---
        const isTouchingWall =
            (playerBody.blocked.left || playerBody.blocked.right) &&
            !isGrounded;
        const isFalling = playerBody.velocity.y > 0;
        let isWallSliding = false;

        if (isTouchingWall && isFalling) {
            this.player.setVelocityY(50); // Slide
            isWallSliding = true;

            // Wall Jump Input
            if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
                const jumpDirection = playerBody.blocked.left ? 1 : -1;
                this.player.setVelocityX(speed * 1.5 * jumpDirection);
                // Wall Jump reduzido
                this.player.setVelocityY(-230);
                this.player.setFlipX(jumpDirection === -1);

                // Recupera o Double Jump ao fazer Wall Jump? (Geralmente sim em jogos como Celeste)
                // Se não quiser, comente a linha abaixo.
                this.canDoubleJump = true;

                this.dustEmitter.speedX = { min: -20, max: 20 };
                this.dustEmitter.explode(4);
                isWallSliding = false;
            }
        }

        // --- 4. ANIMAÇÕES (CORRIGIDO) ---
        // Verificamos se está no meio do Double Jump para não interromper
        const isDoubleJumping =
            this.player.anims.currentAnim?.key === "double_jump" &&
            this.player.anims.isPlaying;

        if (isWallSliding) {
            this.player.anims.play("wall_jump", true);
        } else if (!isGrounded) {
            // Se estiver rodando o Double Jump, só trocamos se ele acabar
            if (!isDoubleJumping) {
                if (playerBody.velocity.y < 0) {
                    this.player.anims.play("jump", true);
                } else {
                    this.player.anims.play("fall", true);
                }
            }
        } else {
            // Está no chão
            if (playerBody.velocity.x !== 0) {
                this.player.anims.play("run", true);
            } else {
                this.player.anims.play("idle", true);
            }
        }

        // --- 5. PARTÍCULAS (Chão) ---

        // A. Impacto ao Cair (LANDING)
        if (isGrounded && this.wasInAir) {
            this.dustEmitter.speedX = { min: -50, max: 50 };
            this.dustEmitter.speedY = { min: -20, max: 0 };

            // Esquerda
            this.dustEmitter.followOffset.set(-10, 12);
            this.dustEmitter.explode(10);

            // Direita
            this.dustEmitter.followOffset.set(10, 12);
            this.dustEmitter.explode(10);
        }

        // B. Correndo
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
        } else {
            this.dustTimer = 0;
        }

        // Atualiza o estado
        this.wasInAir = !isGrounded;
    }
}
