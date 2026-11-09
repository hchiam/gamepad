import { Input, InputEvent, Button, Key, GameLoop } from './input.js';

const input = new Input({
  keyboard: {
    1: {
      [Key.W]: Button.up,
      [Key.A]: Button.left,
      [Key.S]: Button.down,
      [Key.D]: Button.right,
    },
    2: {
      [Key.ArrowUp]: Button.up,
      [Key.ArrowDown]: Button.down,
      [Key.ArrowLeft]: Button.left,
      [Key.ArrowRight]: Button.right,
    },
  },
});

function jump({ player, button }) {
  if (button === Button.south) console.log(`player ${player} jumps`);
}
input.on(InputEvent.press, jump);

function moveLeft(player, seconds) {
  console.log(`player ${player} moves left for ${seconds} seconds`);
}

const gameLoop = new GameLoop((seconds) => {
  for (const player of [1, 2]) {
    if (input.isPressed(player, Button.left)) moveLeft(player, seconds);
  }
}).start();

// eslint-disable-next-line no-unused-vars
function pause() {
  input.off(InputEvent.press, jump);
  gameLoop.stop();
}
