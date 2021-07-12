const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const collectBlock = require("mineflayer-collectblock").plugin;

// Create the bot
const bot = mineflayer.createBot({
  host: "localhost",
  port: 62115,
  version: "1.16.5",
  username: "TotallyNotABot",
});

// Load plugins
bot.loadPlugin(pvp);
bot.loadPlugin(pathfinder);
bot.loadPlugin(armorManager);
bot.loadPlugin(collectBlock);

// Set mcData and movements
let mcData;
let movements;
bot.once("spawn", () => {
  mcData = require("minecraft-data")(bot.version);
  movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);
});

let boss;

function health(username, args) {
  /** Tell what the current health is */
  bot.chat(`Mine own current health is: ${bot.health}`);
  console.log(`Health: ${bot.health}`);
}

function food(username, args) {
  /** Tell what the current food and saturation levels are  */
  bot.chat(
    `Mine own food is ${bot.food} and mine own saturation is ${bot.foodSaturation}`
  );
  console.log(`Food: ${bot.food}\tSaturation: ${bot.foodSaturation}`);
}

function items(username, args) {
  /** List all items in the bots inventory */
  // Get a list of all the display names
  let items = bot.inventory
    .items()
    .map((a) => ` '${a.count} ${a.displayName}'`);

  // Check if we have no items
  if (items.length == 0) {
    bot.chat(`I currently carryeth with me: nothing`);
    console.log(`Items: None`);
  } else {
    bot.chat(`I currently carryeth with me: ${items}`);
    console.log(`Items: ${items}`);
  }
}

function drop(username, args) {
  /** Drops an item out of the bot's inventory */

  const player = bot.players[username];
  if (player.entity === undefined) {
    bot.chat(`I can't seeth thee, ${username}`);
    return;
  }

  come(username, args);
  bot.lookAt(player.entity.position);

  let count = 1;
  if (args.length === 3) count = parseInt(args[2]);

  let type = args[1];

  const itemType = mcData.itemsByName[type];
  if (!itemType) {
    bot.chat(`I knoweth not any block nam'd ${type}.`);
    return;
  }
  const item = bot.inventory
    .items()
    .find((items) => items.name == itemType.name);

  bot.chat(`H're, has't ${count} ${itemType.displayName}`);
  bot.toss(itemType, count);
}

function come(username, args) {
  /** The bot comes to the user once */
  // Get the player
  const player = bot.players[username];
  if (player.entity === undefined) {
    bot.chat(`I can't seeth thee, ${username}`);
    return;
  }

  bot.chat(`I'm coming to thee, ${username}`);

  // Get the goal for the player and go to it
  const goal = new goals.GoalFollow(player.entity);
  bot.pathfinder.goto(goal, () => {
    bot.chat(`I did get to ${goal.entity.username}`);
  });
}

function mine(username, args) {
  /** Makes the bot mine a certain block type (args[1]) amount (args[2]) */
  let count = 1;
  if (args.length === 3) count = parseInt(args[2]);

  let type = args[1];

  const blockType = mcData.blocksByName[type];
  if (!blockType) {
    bot.chat(`I knoweth not any block nam'd ${type}.`);
    return;
  }

  const blocks = bot.findBlocks({
    matching: blockType.id,
    maxDistance: 64,
    count: count,
  });

  if (blocks.length === 0) {
    bot.chat("I seeth not yond block nearby.");
    return;
  }

  // Create the list of targets
  const targets = [];
  for (let i = 0; i < Math.min(blocks.length, count); i++) {
    targets.push(bot.blockAt(blocks[i]));
  }

  bot.chat(`Hath found ${targets.length} ${type}(s).`);

  bot.collectBlock.collect(targets, (err) => {
    if (err) {
      // An error occurred, report it.
      bot.chat(err.message);
      console.log(err);
    } else {
      // All blocks have been collected.
      bot.chat("Done.");
    }
  });
}

function guard(username, args, log = true) {
  /** Gaurd a certain user */
  const player = bot.players[username];
  if (player.entity === undefined) {
    if (log) {
      bot.chat(`I can't seeth thee, ${username}`);
    }
    return;
  }

  if (log) {
    bot.chat(`I'm coming to guard thee, ${username}`);
  }
  boss = player;

  // Follow the user
  const goal = new goals.GoalFollow(player.entity, 2);
  bot.pathfinder.setGoal(goal, true);
}

bot.on("chat", (username, message) => {
  /** Run the commands when a chat message was send */
  if (username === bot.username) return;

  args = message.split(" ");

  if (args[0] === "health") {
    health(username, args);
  } else if (args[0] === "food") {
    food(username, args);
  } else if (args[0] === "items") {
    items(username, args);
  } else if (args[0] === "drop") {
    drop(username, args);
  } else if (args[0] === "come") {
    come(username, args);
  } else if (args[0] === "mine") {
    mine(username, args);
  } else if (args[0] === "guard") {
    guard(username, args);
  }
});

function equipWeapons() {
  const items = bot.inventory.items();

  const shield = items.find((items) => items.name === "shield");
  if (shield) bot.equip(shield, "off-hand");

  const swords = items.filter((items) => items.name.includes("sword"));

  function findSword(name) {
    return swords.find((swords) => swords.name.includes(name));
  }

  const sword_tiers = [
    "wooden",
    "gold",
    "stone",
    "iron",
    "diamond",
    "netherite",
  ];

  let sword;
  for (const sword_tier of sword_tiers) {
    sword = findSword(sword_tier);
  }

  if (!bot.pathfinder.isMining() && !bot.pathfinder.isBuilding() && sword) {
    bot.equip(sword, "hand");
  }
}

bot.on("physicTick", () => {
  let mobFilter;
  if (boss === undefined) {
    mobFilter = (e) =>
      e.type === "mob" && e.position.distanceTo(bot.entity.position) < 8;
  } else {
    mobFilter = (e) =>
      e.type === "mob" && e.position.distanceTo(boss.entity.position) < 8;
  }

  const mob = bot.nearestEntity(mobFilter);

  if (mob) {
    equipWeapons();
    bot.pvp.attack(mob);
  }
});

bot.on("stoppedAttacking", () => {
  if (boss === undefined) return;

  guard(boss.username, [], false);
});
