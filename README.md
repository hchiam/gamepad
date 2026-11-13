# gamepad

local multiplayer input for the browser: several gamepads and keyboard players on one device, in one tab. no dependencies, no networking

_**work in progress**_

live demo: <https://hchiam-gamepad.surge.sh>

## usage

```js
import { Input, InputEvent, Button, Key, GameLoop } from './input.js';

const input = new Input({
  keyboard: {
    1: { [Key.W]: Button.up, [Key.S]: Button.down, [Key.A]: Button.left, [Key.D]: Button.right },
    2: { [Key.ArrowUp]: Button.up, [Key.ArrowDown]: Button.down },
  },
});

input.on(InputEvent.press, ({ player, button }) => {});
input.on(InputEvent.connect, ({ player, id, type }) => {});

const gameLoop = new GameLoop((seconds) => {
  if (input.isPressed(1, Button.left)) {
    // move player 1 left by speed * seconds
  }
}).start();

gameLoop.stop(); // pause
gameLoop.start(); // resume
```

see [test-example-usage.js](test-example-usage.js) for a fuller example

**always call `input.destroy()`** when you're done with an `Input`, for example when leaving the game screen. otherwise its keyboard listeners and gamepad polling keep running

## notes

- serve over HTTPS or `localhost`. the gamepad API may not work from `file://`
- browsers hide gamepads until a button is pressed on the page, so show "press any button"
- gamepads get the lowest player number not used by keyboard players or other gamepads
- only controllers the browser reports with the standard layout (`mapping: 'standard'`) are read for now. PS5, Xbox, and Joy-Con L+R in Chrome all do
- Joy-Cons: use Chrome. Chrome combines a connected L+R pair into one player, and doesn't expose single Joy-Cons. Firefox on macOS lists each Joy-Con separately but sends no input from them
- some keys aren't in `Key` on purpose: Control (Ctrl+W closes the tab, and Macs have no `ControlRight`) and Command / Windows (keys get stuck on Mac, and they trigger system shortcuts)

## buttons

`Button` names are by position, not by the label printed on the button. `north`, `south`, `east`, and `west` are the four face buttons, not directions

| `Button` | PS5 | Xbox | Nintendo |
| --- | --- | --- | --- |
| `up` `down` `left` `right` | d-pad | d-pad | d-pad (left Joy-Con arrows) |
| `south` | cross | A | B |
| `east` | circle | B | A |
| `west` | square | X | Y |
| `north` | triangle | Y | X |
| `leftShoulder` | L1 | LB | L |
| `rightShoulder` | R1 | RB | R |
| `leftTrigger` | L2 | LT | ZL |
| `rightTrigger` | R2 | RT | ZR |
| `leftStickPress` | L3 | left stick click | left stick click |
| `rightStickPress` | R3 | right stick click | right stick click |
| `select` | create | view | minus |
| `start` | options | menu | plus |
| `home` | PS | Xbox | home |

## sticks

read sticks each frame, like `isPressed`:

```js
import { Stick } from './input.js';

const { x, y } = input.stick(player, Stick.left); // or Stick.right
```

- `x` and `y` go from -1 to 1. `y` is positive downward, like screen coordinates
- a small area around the center counts as 0 (the deadzone), so worn sticks don't drift
- each stick's resting position is measured when the controller connects, so a stick that rests slightly off-center still reads 0. if a stick is held when the controller connects, reconnect it
- keyboard players have no sticks, so `stick()` returns `{ x: 0, y: 0 }` for them

## controller types and labels

show players the names printed on their own controller, for example "press cross" on PS5 and "press A" on Xbox:

```js
import { buttonLabel } from './input.js';

input.on(InputEvent.connect, ({ player, type }) => {
  showMessage(`player ${player}: press ${buttonLabel(Button.south, type)} to join`);
});
```

- `type` is one of `ControllerType.playstation`, `xbox`, `nintendo`, or `generic`, detected from the controller's `id`
- `controllerTypeOf(id)` does the same detection if you only have an `id`
- `buttonLabel(button, type)` returns the printed label (see the table in [buttons](#buttons)). generic controllers, keyboard players, and the d-pad get the position name back, like `'south'` or `'up'`
- labels only change what you show. `Button` names stay the same on every controller

## letting players remap

let a player choose which of their buttons acts as which `Button`. your game keeps checking the same `Button` names:

```js
async function chooseJumpButton(player) {
  showMessage(`player ${player}: press the button you want for jump`);
  const pressed = await input.nextPress(player);
  input.remap(player, { [pressed]: Button.south }); // your game jumps on Button.south
}

input.resetRemap(player); // undo that player's remaps
input.resetRemap(); // undo everyone's
localStorage.setItem('remap-1', JSON.stringify(input.remapOf(1))); // save, then restore with input.remap(1, saved)
```

- `nextPress(player)` waits for the player's next new press. that press doesn't reach your listeners, so choosing a button doesn't also make the character jump
- `cancelNextPress(player)` stops waiting, for example when the player backs out of a settings screen. the waiting `nextPress` then resolves with `null`, so check for that before remapping. disconnecting or `destroy()` also resolves it with `null`
- `remap(player, { [from]: to })` adds to the player's existing remaps. it throws on unknown button names
- remaps work the same for keyboard and gamepad players
- the library doesn't save remaps. saving is up to your game

## demo

[index.html](index.html) shows each player's held buttons, a dot that moves with the sticks and direction buttons (and, in the demo only, the face buttons too), a remap control on each card, and recent events

serve this folder with any local static server and open it from `localhost`. opening `index.html` directly as a file won't work, because browsers block module imports from `file://`

to deploy the demo to <https://hchiam-gamepad.surge.sh> (needs the surge CLI, logged in):

```bash
npm run deploy
```

[.surgeignore](.surgeignore) keeps the tests, README, and `package.json` out of the deployed site

## reading the code

start with [input.js](input.js). it's the only file games import from. it wires in the sources:

- [keyboard.js](keyboard.js)
- [gamepad.js](gamepad.js)
- [button.js](button.js): the button names shared by both
- [stick.js](stick.js): the stick names
- [labels.js](labels.js): controller types and button labels
- [gameloop.js](gameloop.js): the optional `GameLoop` helper

## extra options

not needed for the basics, but available for more control:

- `new Input({ gamepads: false })`: ignore gamepads, for example in a keyboard-only game. gamepads are on by default
- `new Input({ stickDeadzone: 0.15 })`: how far a stick must move from center before it counts. the default is `0.15`. raise it if a controller still drifts
- `new GameLoop(update, { maxSecondsPerFrame: 0.1 })`: the most `seconds` a single frame can report. the default of `0.1` makes the game pause through gaps like a background tab, instead of jumping ahead. use `Infinity` for no cap. for timers tied to the real clock, use `performance.now()`
- `new Input({ gamepadProfiles: [...] })`: fix the button mapping for a specific controller. see below

### custom gamepad profiles

some controllers report their face buttons in an unexpected order. a profile fixes that for any controller whose `id` matches:

```js
const input = new Input({
  gamepadProfiles: [
    {
      matches: /Vendor: 0079 Product: 0006/,
      buttonByIndex: { 0: Button.north, 1: Button.east, 2: Button.south, 3: Button.west },
    },
  ],
});
```

- `matches` is tested against the controller's `id`, which the `connect` event gives you
- `buttonByIndex` maps the browser's raw button numbers to `Button` names. list only the buttons you want to change. the rest keep the standard mapping
- custom profiles are checked before the built-in ones
- to find the raw numbers, press each button while watching `navigator.getGamepads()` in the browser console
- the example above fixes one generic USB pad. other pads with the same vendor and product numbers may be wired differently

## running the tests

```bash
node test-smoke.mjs
```

each check prints ✅ or ❌, and the exit code is 1 if any check fails

[test-example-usage.js](test-example-usage.js) needs a browser. it shows usage and isn't run by node
