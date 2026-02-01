import { Scene } from "phaser";

export class Game extends Scene {
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private worldLayer: Phaser.Tilemaps.TilemapLayer; // <--- Adicione isto aqui!

    constructor() {
        super("Game");
    }

    create() {
        // 1. Criar o Mapa
        const map = this.make.tilemap({ key: "mapa_fase1" });

        // 2. Adicionar o Tileset (o nome do tileset em terrain.tsx é 'terrain' e a key da imagem carregada no Preloader é 'terrain-tiles')
        const tileset = map.addTilesetImage("terrain", "terrain-tiles");
        const tilesetBlue = map.addTilesetImage("Blue back", "blue-img"); // Certifique-se que carregou 'blue-img' no Preloader

        this.cursors = this.input.keyboard!.createCursorKeys();

        // 3. Criar as Camadas (Use os nomes exatos das suas Layers no Tiled)
        const bgLayer = map.createLayer("background", tilesetBlue!, 0, 0);
        this.worldLayer = map.createLayer("world", tileset!, 0, 0)!; // bgLayer?.setScrollFactor(0.5); // O fundo se move na metade da velocidade (Parallax)
        this.worldLayer.setCollisionByExclusion([-1]);

        this.worldLayer.forEachTile((tile) => {
            // Para descobrir o ID, você pode dar um console.log(tile.index) aqui
            console.log(tile.properties, tile.index);

            if (tile.properties.through || tile.index === 41) {
                // Permite pular através dele, mas ficar em cima
                tile.setCollision(false, false, true, false);
                tile.alpha = 1; // Garante que está visível
                tile.visible = true; // Garante que não foi escondido
            }
        });

        // 4. Ativar Colisão no Chão
        // Se você usou a propriedade 'collides' no Tiled:
        // worldLayer?.setCollisionByProperty({ collides: true });
        // Ou se quiser que tudo que não seja vazio colida:
        // worldLayer!.setCollisionByExclusion([-1]);

        if (bgLayer) {
            bgLayer.setDepth(-1); // Garante que ele fique no "fundo do fundo"
            bgLayer.setAlpha(1); // Garante que não esteja transparente
        }
        console.log("Tiles no background:", bgLayer?.getTilesWithin().length);

        // 5. Spawn do Player (usando o ponto que você criou na Object Layer)
        const spawnPoint = map.findObject("player", (obj) => {
            console.log(obj);

            return obj.name === "PlayerSpawn";
        });

        this.player = this.physics.add.sprite(
            spawnPoint!.x!,
            spawnPoint!.y!,
            "player_idle",
        );

        this.player.body?.setSize(25, 25);
        // Física do Player
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.worldLayer!);

        // 6. Câmera
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels,
        );

        // 7. Criar Animação do Morango
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

        // Animação Correndo
        this.anims.create({
            key: "run",
            frames: this.anims.generateFrameNumbers("player_run", {
                start: 0,
                end: 11,
            }),
            frameRate: 20,
            repeat: -1,
        });

        // Animação Pulando (Geralmente 1 frame só ou poucos)
        this.anims.create({
            key: "jump",
            frames: [{ key: "player_jump", frame: 0 }],
            frameRate: 20,
        });

        // Animação Caindo
        this.anims.create({
            key: "fall",
            frames: [{ key: "player_fall", frame: 0 }],
            frameRate: 20,
        });

        // 8. Colocar os Morangos da Object Layer
        const fruits = this.physics.add.group({ allowGravity: false });
        const fruitPoints = map.filterObjects(
            "collectibles",
            (obj) => obj.name !== "Strawberry",
        );
        console.log(fruitPoints);

        fruitPoints?.forEach((point) => {
            const f = fruits.create(point.x, point.y, "strawberry");
            f.play("strawberry_idle");

            // --- AJUSTE DA HITBOX AQUI ---
            // O morango é pequeno, então uma caixa de 14x14 costuma servir bem
            f.body?.setSize(14, 14);

            // Centraliza a caixa no desenho (ajuste os valores se precisar subir ou descer)
            f.body?.setOffset(9, 9);
        });

        this.physics.add.overlap(this.player, fruits, (p, f) => {
            (f as Phaser.Physics.Arcade.Sprite).destroy();
            // Aqui você dispararia o EventBus para o React
        });

        this.cameras.main.setZoom(2);
    }

    update() {
        const speed = 160;
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

        // 1. Lógica de Movimento Horizontal
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        // 2. Lógica de Pulo
        if (this.cursors.up.isDown && playerBody.blocked.down) {
            this.player.setVelocityY(-350);
        }
        if (playerBody.velocity.y < 0 && !this.cursors.up.isDown) {
            // Multiplicamos por 0.8 para dar uma freada suave na subida
            this.player.setVelocityY(playerBody.velocity.y * 0.8);
        }

        // 3. MÁQUINA DE ANIMAÇÕES
        if (!playerBody.blocked.down) {
            // Se estiver no ar...
            if (playerBody.velocity.y < 0) {
                this.player.anims.play("jump", true);
            } else {
                this.player.anims.play("fall", true);
            }
        } else {
            // Se estiver no chão...
            if (playerBody.velocity.x !== 0) {
                this.player.anims.play("run", true);
            } else {
                this.player.anims.play("idle", true);
            }
        }

        const worldLayer = this.worldLayer; // Certifique-se de ter acesso à layer

        // 1. Detectar se há parede sem precisar apertar botão
        // Checamos um ponto 2 pixels para fora da hitbox do sapo
        const wallLeft = worldLayer.getTileAtWorldXY(
            this.player.x - 2,
            this.player.y,
        );
        const wallRight = worldLayer.getTileAtWorldXY(
            this.player.x + this.player.width + 2,
            this.player.y,
        );

        // Um tile conta como parede se ele existir e tiver colisão ativa
        const isTouchingWall =
            (wallLeft && wallLeft.collides) ||
            (wallRight && wallRight.collides);
        const isFalling = playerBody.velocity.y > 0;

        // 2. Lógica de Escorregar (Passiva)
        if (isTouchingWall && !playerBody.blocked.down && isFalling) {
            this.player.setVelocityY(50); // Velocidade lenta de slide

            // Se o seu sapo olha para o lado oposto da parede enquanto escorrega
            if (wallLeft) this.player.setFlipX(false);
            if (wallRight) this.player.setFlipX(true);

            this.player.anims.play("wall_jump", true); // Usa o frame de parede
            if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
                // Se estou na parede da esquerda, pulo para a DIREITA (1)
                // Se estou na parede da direita, pulo para a ESQUERDA (-1)
                const jumpDirection = wallLeft ? 1 : -1;

                // Aplica o impulso diagonal
                this.player.setVelocityX(speed * 1.5 * jumpDirection);
                this.player.setVelocityY(-300);

                // Inverte o sprite para olhar para onde está pulando
                this.player.setFlipX(jumpDirection === -1);
            }
        }
    }
}

