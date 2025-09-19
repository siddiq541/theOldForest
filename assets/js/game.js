function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // remove punctuation
    .replace(/\b(a|an|the)\b/g, "") // remove common articles
    .replace(/\s+/g, " ")
    .trim();
}
//   Classes
class Item {
  constructor(name, description = "") {
    this.name = name;
    this.description = description;
  }
}

class Room {
  constructor(name, description = "", image = "") {
    this.name = name;
    this.description = description;
    this.image = image;
    this.linkedRooms = {};
    this.character = null;
    this.items = [];
    this.image = image;
    this.clearedImage = null;
  }
  get image() {
    return this._image;
  }

  set image(value) {
    this._image = value;
  }
  get displayImage() {
    if (
      this.character instanceof RiddleCharacter &&
      this.character.solved &&
      this.clearedImage
    ) {
      return this.clearedImage;
    }
    return this._image;
  }

  linkRoom(direction, room) {
    this.linkedRooms[direction] = room;
  }

  move(direction) {
    return this.linkedRooms[direction] || null;
  }

  getDetails() {
    const entries = Object.entries(this.linkedRooms);
    return entries
      .map(([dir, room]) => `The ${room.name} is to the ${dir}.`)
      .join("\n");
  }

  describe() {
    let str = `${this.description}`;
    if (this.items.length) {
      str += "\n\nYou see: " + this.items.map((i) => i.name).join(", ");
    }
    return str;
  }
}

class Character {
  constructor(name, description = "") {
    this.name = name;
    this.description = description;
  }

  describe() {
    return `${this.name} — ${this.description}`;
  }
}

class RiddleCharacter extends Character {
  constructor(name, description, riddle, answers = [], rewardItem = null) {
    super(name, description);
    this.riddle = riddle;
    this.answers = answers.map(normalizeAnswer);
    this.attempts = 3;
    this.solved = false;
    this.rewardItem = rewardItem; // string or null
  }

  interactText() {
    if (this.solved) return `${this.name} has already been answered.`;
    return `${this.description}\n\nRiddle: ${this.riddle}\n\n(Answer by typing: answer <your answer>)`;
  }

  tryAnswer(rawInput) {
    if (this.solved)
      return {
        status: "already",
        message: `You already answered ${this.name}.`,
      };

    const guess = normalizeAnswer(rawInput);
    if (this.answers.includes(guess)) {
      this.solved = true;
      return {
        status: "correct",
        message: `✅ Correct! ${this.name} accepts your answer.`,
        reward: this.rewardItem,
      };
    }

    this.attempts--;
    if (this.attempts <= 0) {
      return {
        status: "dead",
        message: `❌ Wrong! No attempts left. ${this.name} triggers your doom. GAME OVER.`,
      };
    }

    return {
      status: "wrong",
      message: `❌ Wrong! You have ${this.attempts} attempts left.`,
    };
  }
}

class Player {
  constructor() {
    this.inventory = [];
    this.currentRoom = null;
  }

  addItem(item) {
    if (!this.hasItem(item.name)) {
      this.inventory.push(item);
    }
  }

  hasItem(name) {
    name = String(name || "").toLowerCase();
    return this.inventory.some((it) => it.name.toLowerCase() === name);
  }

  inventoryList() {
    if (this.inventory.length === 0) return "(empty)";
    return this.inventory.map((it) => it.name).join(", ");
  }
}

//   Game (setup + UI)

class Game {
  constructor() {
    // DOM refs
    this.gameText = document.getElementById("gameText");
    this.input = document.getElementById("usertext");
    this.status = document.getElementById("status");
    this.inventoryPanel = document.getElementById("inventory");

    this.player = new Player();
    this.rooms = {};
    this.gameOverFlag = false;

    this.bindInput();
    this.initWorld(); // setup world
  }

  log(html) {
    const p = document.createElement("p");
    p.innerHTML = html;
    this.gameText.appendChild(p);
    this.gameText.scrollTop = this.gameText.scrollHeight;
  }

  clearLog() {
    this.gameText.innerHTML = "";
  }

  setStatus(text, isError = false) {
    this.status.textContent = text || "";
    this.status.className = isError
      ? "text-center text-sm text-red-400 font-semibold"
      : "text-center text-sm text-green-300 font-semibold";
  }

  updateInventoryUI() {
    if (!this.inventoryPanel) return;
    this.inventoryPanel.innerHTML = `
      <h2 class="text-lg font-semibold text-yellow-300">Inventory</h2>
      <div class="text-gray-300 text-sm">${this.player.inventoryList()}</div>
    `;
  }

  bindInput() {
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const value = this.input.value.trim();
        this.input.value = "";
        if (!value) return;
        this.handleCommand(value);
      }
    });
  }
  refreshCurrentRoom() {
    this.enterRoom(this.player.currentRoom);
  }
  // ----------------
  // Restart function
  restartGame() {
    this.player = new Player();
    this.gameOverFlag = false;
    this.clearLog();
    this.initWorld();
    this.updateInventoryUI();
  }

  // ----------------
  initWorld() {
    // Rooms
    const forest = new Room(
      "Forest Entrance",
      "You stand at the edge of the Old Forest. A path winds deeper into the shadows. Legends say treasures lie within, but few return.",
      "/assets/img/forest.jpg"
    );
    const bridge = new Room(
      "Bridge",
      "An ancient mossy bridge stretches over a rushing river. A hulking troll blocks the way.",
      "/assets/img/monster.jpg"
    );
    bridge.clearedImage = "/assets/img/bridge.jpg";
    const river = new Room(
      "River",
      "A glittering river cuts through the forest. The water ripples oddly.",
      "/assets/img/nymph.jpg"
    );
    river.clearedImage = "/assets/img/water.jpg";
    const castle = new Room(
      "Old Castle",
      "You are now in an old castle standing before a dragon sleeping on treasure. A sinister dwarf appears before you.",
      "/assets/img/castle.jpg"
    );
    const home = new Room(
      "Home",
      "You are suddenly transported back home safely standing in your backyard.",
      "/assets/img/home.jpg"
    );

    // Links
    forest.linkRoom("east", bridge);
    forest.linkRoom("south", river);
    forest.linkRoom("west", castle);
    bridge.linkRoom("west", forest);
    river.linkRoom("north", forest);
    castle.linkRoom("east", forest);

    // Characters
    const troll = new RiddleCharacter(
      "Troll",
      "A huge troll stands in the middle of the bridge blocking your way.",
      "Walk right through me, never feel me. Always lurking, never seen. What am I?",
      ["shadow", "a shadow"],
      "Stone Key"
    );

    const nymph = new RiddleCharacter(
      "Water Nymph",
      "An eerie looking water nymph stands in the river and prevents you from moving with her magical powers.",
      "What always runs but never walks, has a bed but never sleeps?",
      ["river", "a river"],
      "Water Key"
    );

    const dwarf = new RiddleCharacter(
      "Sinister Dwarf",
      "A sinister dwarf appears before you and asks you a riddle.",
      "I am always hungry, I must always be fed, The finger I touch will soon turn red.",
      ["fire"],
      "Treasure (Victory)"
    );

    // Attach characters
    bridge.character = troll;
    river.character = nymph;
    castle.character = dwarf;

    // Store rooms
    this.rooms = { forest, bridge, river, castle, home };

    // Reset solved state
    for (const room of Object.values(this.rooms)) {
      if (room.character && room.character instanceof RiddleCharacter) {
        room.character.solved = false;
        room.character.attempts = 3;
      }
    }

    // Set player start
    this.player.currentRoom = forest;

    // Update UI
    this.clearLog();
    this.updateInventoryUI();
    this.setStatus("Type 'help' for commands.");

    // Show initial room
    this.enterRoom(this.player.currentRoom);
  }

  enterRoom(room) {
    if (!room) {
      this.log(`<em>There is nothing that way.</em>`);
      return;
    }

    this.clearLog();
    this.player.currentRoom = room;

    // Room name
    const title = document.createElement("p");
    title.className = "text-center font-bold text-lg mb-2 text-green-300";
    title.innerHTML = `📍 ${room.name}`;
    this.gameText.appendChild(title);

    // Room image with fade-in
    if (room.displayImage) {
      const imgContainer = document.createElement("div");
      imgContainer.className =
        "mx-auto mb-2 transition-opacity duration-700 opacity-0";

      const img = document.createElement("img");
      img.src = room.displayImage;
      img.alt = room.name;
      img.className =
        "rounded-lg shadow-lg max-w-70 max-h-[60vh] mx-auto object-contain";

      imgContainer.appendChild(img);
      this.gameText.appendChild(imgContainer);

      requestAnimationFrame(() => {
        imgContainer.classList.remove("opacity-0");
        imgContainer.classList.add("opacity-100");
      });
    }

    // Room description
    if (room.describe()) {
      const desc = document.createElement("p");
      desc.className = "text-center text-gray-200 mb-2";
      desc.innerText = room.describe();
      this.gameText.appendChild(desc);
    }

    // Character / Riddle
    if (room.character) {
      if (room.character instanceof RiddleCharacter) {
        const riddleDiv = document.createElement("div");
        riddleDiv.className =
          "text-center italic text-yellow-300 p-2 border-t border-b border-yellow-500 my-2";
        riddleDiv.innerText = room.character.interactText();
        this.gameText.appendChild(riddleDiv);
      } else {
        const charDesc = document.createElement("p");
        charDesc.className = "text-center mb-2";
        charDesc.innerText = room.character.describe();
        this.gameText.appendChild(charDesc);
      }
    }

    // Linked room details
    const details = room.getDetails();
    if (details) {
      const detailP = document.createElement("p");
      detailP.className = "text-center text-sm text-green-300 mt-2";
      detailP.innerHTML = details.replace(/\n/g, "<br>");
      this.gameText.appendChild(detailP);
    }
    this.updateInventoryUI();
  }

  handleCommand(raw) {
    const cmd = raw.trim();
    const lower = cmd.toLowerCase();

    // Restart always works
    if (lower === "restart") {
      this.restartGame();
      return;
    }

    // Block other commands if game over
    if (this.gameOverFlag) {
      this.setStatus("Game over. Type 'restart' to play again.", true);
      return;
    }

    // Help
    if (lower === "help") {
      this.log(
        `<strong>Commands:</strong> north / south / east / west  |  go <dir>  |  answer <text>  |  look  |  inventory  |  restart`
      );
      return;
    }

    // Look
    if (lower === "look" || lower === "l") {
      this.enterRoom(this.player.currentRoom);
      return;
    }

    // Inventory
    if (lower === "inventory" || lower === "i") {
      this.log(`<strong>Inventory:</strong> ${this.player.inventoryList()}`);
      return;
    }

    // Movement
    const moveMatch = lower.match(/^(go\s+)?(n|s|e|w|north|south|east|west)$/);
    if (moveMatch) {
      let dir = moveMatch[2];
      const map = { n: "north", s: "south", e: "east", w: "west" };
      if (dir.length === 1) dir = map[dir];
      this.attemptMove(dir);
      return;
    }

    // Answer
    const answerMatch = lower.match(/^(answer|say|reply)\s+(.+)$/i);
    if (answerMatch) {
      this.attemptAnswer(answerMatch[2]);
      return;
    }

    // Single word answer if riddle present
    if (["north", "south", "east", "west"].includes(lower)) {
      this.attemptMove(lower);
      return;
    }
    const maybeRiddle =
      this.player.currentRoom.character instanceof RiddleCharacter &&
      !this.player.currentRoom.character.solved;
    if (maybeRiddle) {
      this.attemptAnswer(cmd);
      return;
    }

    this.log(
      `<em>Unknown command: "${cmd}". Type 'help' for a list of valid commands.</em>`
    );
  }

  attemptMove(direction) {
    const next = this.player.currentRoom.move(direction);
    if (!next) {
      this.log(`❌ You can't go ${direction} from here.`);
      return;
    }
    if (next.name === "Old Castle") {
      const hasStone = this.player.hasItem("Stone Key");
      const hasWater = this.player.hasItem("Water Key");
      if (!hasStone || !hasWater) {
        this.log(
          "⚠️ The castle gates are magically sealed. You need both the Stone Key and Water Key to enter."
        );
        return; // stop move
      }
    }
    this.enterRoom(next);
  }

  attemptAnswer(answerText) {
    const character = this.player.currentRoom.character;
    if (!character || !(character instanceof RiddleCharacter)) {
      this.log("There's no riddle here to answer.");
      return;
    }

    const result = character.tryAnswer(answerText);

    if (result.status === "correct") {
      this.log(result.message);

      // Give reward
      if (character.rewardItem) {
        const reward = character.rewardItem;
        if (reward.toLowerCase().includes("key")) {
          this.player.addItem(new Item(reward));
          this.log(`🔑 You received: <strong>${reward}</strong>`);
          this.updateInventoryUI();
        }
      }

      // Check victory
      if (character.name.toLowerCase().includes("dwarf")) {
        const hasStone = this.player.hasItem("Stone Key");
        const hasWater = this.player.hasItem("Water Key");
        if (hasStone && hasWater) {
          this.log(
            "✨ As you answer, the castle trembles and the treasure room opens. You are transported home with the treasure!"
          );
          this.enterRoom(this.rooms.home);
          this.setStatus("🎉 YOU WIN! Type 'restart' to play again.");
          this.gameOverFlag = true;
        } else {
          this.log(
            "The dwarf nods, but nothing happens — you need both the Stone Key and the Water Key to claim the treasure. Find them first."
          );
        }
      }
    } else if (result.status === "wrong") {
      this.log(result.message);
    } else if (result.status === "dead") {
      this.log(result.message);
      this.setStatus("💀 GAME OVER. Type 'restart' to try again.", true);
      this.gameOverFlag = true;
    } else if (result.status === "already") {
      this.log(result.message);
    }
    this.refreshCurrentRoom();
  }
}
// Start the game
window.addEventListener("DOMContentLoaded", () => {
  window.theOldForest = new Game();
});
