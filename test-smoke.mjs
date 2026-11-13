import { Input, InputEvent, Button, Stick, GameLoop, ControllerType, controllerTypeOf, buttonLabel } from './input.js';
import { listenToKeyboard } from './keyboard.js';
import { listenToGamepads } from './gamepad.js';

globalThis.window = new EventTarget();
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const warnings = [];
console.warn = (message) => warnings.push(message);
const infos = [];
console.info = (message) => infos.push(message);

let passes = 0;
let failures = 0;
function check(label, actual, expected) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    passes++;
  } else {
    failures++;
  }
  console.log(`${passed ? '✅' : '❌'} ${label}`);
  if (!passed) console.log('   expected:', expected, '\n   actual:  ', actual);
}

function key(type, code) {
  const event = new Event(type, { cancelable: true });
  event.code = code;
  window.dispatchEvent(event);
  return event.defaultPrevented;
}



console.log('\n--- Input ---');



const input = new Input({ gamepads: false });
const f = () => {};
check('.on(...) returns the input for chaining', input.on(InputEvent.press, f) === input, true);
input.off(InputEvent.press, f);
check('press/release are private', [typeof input.press, typeof input.release], ['undefined', 'undefined']);
check('.isPressed(...) is false by default', input.isPressed(1, Button.up), false);
check('Button is frozen', Object.isFrozen(Button), true);
check('Button names', Object.keys(Button), [
  'up', 'down', 'left', 'right',
  'north', 'south', 'east', 'west',
  'leftShoulder', 'rightShoulder', 'leftTrigger', 'rightTrigger',
  'leftStickPress', 'rightStickPress', 'select', 'start', 'home',
]);
let unknownEventError = null;
try { input.on('pres', f); } catch (e) { unknownEventError = e.message; }
check('unknown event type throws', unknownEventError, 'Unknown input event type: "pres"');



console.log('\n--- keyboard.js ---');



const keyboardLog = [];
const stopListeningToKeyboard = listenToKeyboard(
  { 1: { KeyW: Button.up }, 2: { ArrowUp: Button.up } },
  {
    press: (player, button) => keyboardLog.push(`press p${player} ${button}`),
    release: (player, button) => keyboardLog.push(`release p${player} ${button}`),
  },
);
check('mapped key prevents default', key('keydown', 'KeyW'), true);
check('mapped key presses p1', keyboardLog, ['press p1 up']);
check('unmapped key does not prevent default', key('keydown', 'KeyQ'), false);
check('unmapped key is ignored', keyboardLog, ['press p1 up']);
key('keydown', 'ArrowUp');
check('second player key presses p2', keyboardLog, ['press p1 up', 'press p2 up']);
key('keyup', 'KeyW');
check('keyup releases p1', keyboardLog, ['press p1 up', 'press p2 up', 'release p1 up']);
window.dispatchEvent(new Event('blur'));
check('window blur releases held p2', keyboardLog, ['press p1 up', 'press p2 up', 'release p1 up', 'release p2 up']);
stopListeningToKeyboard();
key('keydown', 'KeyW');
check('keys ignored after stop', keyboardLog.length, 4);



console.log('\n--- Input + keyboard ---');



const inputWithKeyboard = new Input({
  keyboard: { 1: { KeyW: Button.up } },
  gamepads: false,
});
const inputLog = [];
inputWithKeyboard.on(InputEvent.press, ({ player, button }) => inputLog.push(`press p${player} ${button}`));
inputWithKeyboard.on(InputEvent.release, ({ player, button }) => inputLog.push(`release p${player} ${button}`));
key('keydown', 'KeyW');
key('keydown', 'KeyW');
check('held after auto-repeat', inputWithKeyboard.isPressed(1, Button.up), true);
key('keyup', 'KeyW');
check('not held after keyup', inputWithKeyboard.isPressed(1, Button.up), false);
check('auto-repeat filtered to one press', inputLog, ['press p1 up', 'release p1 up']);



console.log('\n--- Input.destroy() ---');



const destroyLog = [];
const inputToDestroy = new Input({
  keyboard: { 1: { KeyW: Button.up } },
  gamepads: false,
});
inputToDestroy
  .on(InputEvent.press, ({ player, button }) => destroyLog.push(`press p${player} ${button}`))
  .on(InputEvent.release, ({ player, button }) => destroyLog.push(`release p${player} ${button}`));
key('keydown', 'KeyW');
check('key held before destroy', destroyLog, ['press p1 up']);
inputToDestroy.destroy();
check('destroy releases held key first', destroyLog, ['press p1 up', 'release p1 up']);
check('not held after destroy', inputToDestroy.isPressed(1, Button.up), false);
key('keydown', 'KeyW');
check('keys ignored after destroy', destroyLog.length, 2);
let destroyWithoutKeyboardError = null;
try { new Input().destroy(); } catch (e) { destroyWithoutKeyboardError = e.message; }
check('destroy without keyboard does not throw', destroyWithoutKeyboardError, null);



console.log('\n--- gamepad.js ---');



function gamepadEvent(type, gamepad) {
  const event = new Event(type);
  event.gamepad = { axes: [], mapping: 'standard', ...gamepad };
  window.dispatchEvent(event);
}
const padAlreadyConnected = { index: 0, id: 'Pad A', axes: [], mapping: 'standard' };
Object.defineProperty(globalThis, 'navigator', {
  value: { getGamepads: () => [padAlreadyConnected, null] },
  configurable: true,
});
const gamepadLog = [];
const stopListeningToGamepads = listenToGamepads({
  playersTakenByKeyboard: [1, 2],
  connect: (player, id) => gamepadLog.push(`connect p${player} ${id}`),
  disconnect: (player, id) => gamepadLog.push(`disconnect p${player} ${id}`),
});
gamepadEvent('gamepadconnected', padAlreadyConnected);
gamepadEvent('gamepadconnected', { index: 1, id: 'Pad B' });
gamepadEvent('gamepaddisconnected', padAlreadyConnected);
gamepadEvent('gamepadconnected', { index: 2, id: 'Pad C' });
gamepadEvent('gamepaddisconnected', { index: 9, id: 'never connected' });
stopListeningToGamepads();
gamepadEvent('gamepadconnected', { index: 3, id: 'after stop' });
check('p3 A (scan, not doubled), p4 B, A leaves, C reuses p3, nothing else', gamepadLog, [
  'connect p3 Pad A',
  'connect p4 Pad B',
  'disconnect p3 Pad A',
  'connect p3 Pad C',
]);



console.log('\n--- Input + gamepads ---');



const inputWithGamepads = new Input({
  keyboard: { 1: { KeyW: Button.up } },
});
const inputGamepadLog = [];
inputWithGamepads
  .on(InputEvent.connect, ({ player, id }) => inputGamepadLog.push(`connect p${player} ${id}`))
  .on(InputEvent.disconnect, ({ player, id }) => inputGamepadLog.push(`disconnect p${player} ${id}`));
gamepadEvent('gamepadconnected', { index: 1, id: 'Pad B' });
gamepadEvent('gamepaddisconnected', padAlreadyConnected);
inputWithGamepads.destroy();
gamepadEvent('gamepadconnected', { index: 2, id: 'after destroy' });
check('A replayed as p2 (keyboard has p1), B p3, A leaves, nothing after destroy', inputGamepadLog, [
  'connect p2 Pad A',
  'connect p3 Pad B',
  'disconnect p2 Pad A',
]);



console.log('\n--- gamepad polling ---');



let nextFrame = null;
globalThis.requestAnimationFrame = (callback) => { nextFrame = callback; return 1; };
globalThis.cancelAnimationFrame = () => { nextFrame = null; };
function stepFrame() {
  const callback = nextFrame;
  nextFrame = null;
  callback?.();
}
function standardPad(index, id) {
  return {
    index,
    id,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    axes: [0, 0, 0, 0],
  };
}
const padD = standardPad(0, 'Pad D');
const nonStandardPad = { index: 1, id: 'Non-standard', mapping: '', buttons: [{ pressed: true }], axes: [] };
let connectedPads = [padD, nonStandardPad];
Object.defineProperty(globalThis, 'navigator', {
  value: { getGamepads: () => connectedPads },
  configurable: true,
});
const pollingInput = new Input();
const pollingLog = [];
pollingInput
  .on(InputEvent.press, ({ player, button }) => pollingLog.push(`press p${player} ${button}`))
  .on(InputEvent.release, ({ player, button }) => pollingLog.push(`release p${player} ${button}`));
padD.buttons[0].pressed = true;
stepFrame();
stepFrame();
check('held button pressed once across frames', pollingLog, ['press p1 south']);
check('isPressed while held', pollingInput.isPressed(1, Button.south), true);
padD.buttons[0].pressed = false;
padD.buttons[12].pressed = true;
stepFrame();
check('release and new press', pollingLog, ['press p1 south', 'release p1 south', 'press p1 up']);
padD.buttons[16].pressed = true;
stepFrame();
check('home button (standard index 16) pressed', pollingLog.at(-1), 'press p1 home');
padD.buttons[16].pressed = false;
stepFrame();
check('non-standard pad (p2) ignored', pollingLog.some((entry) => entry.includes('p2')), false);
check('non-standard pad gets one console warning, standard pads none', warnings, [
  'this browser reports gamepad "Non-standard" with a non-standard layout, so its buttons and sticks are ignored. a browser like Chrome may recognize it',
]);
connectedPads = [];
gamepadEvent('gamepaddisconnected', padD);
check('disconnect releases held button', pollingLog.at(-1), 'release p1 up');
gamepadEvent('gamepaddisconnected', nonStandardPad);
stepFrame();
check('polling stops when no pads', nextFrame, null);

const padE = standardPad(0, 'Pad E');
connectedPads = [padE];
const inputDestroyedMidPoll = new Input();
inputDestroyedMidPoll.on(InputEvent.press, () => inputDestroyedMidPoll.destroy());
padE.buttons[0].pressed = true;
stepFrame();
stepFrame();
check('destroy during a poll stops the loop', nextFrame, null);

const joyConPair = standardPad(0, 'Joy-Con (L/R) (STANDARD GAMEPAD)');
const singleJoyCon = standardPad(1, 'Joy-Con (L) (STANDARD GAMEPAD)');
connectedPads = [joyConPair, singleJoyCon];
const nintendoInput = new Input();
const nintendoLog = [];
nintendoInput.on(InputEvent.press, ({ player, button }) => nintendoLog.push(`press p${player} ${button}`));
joyConPair.buttons[0].pressed = true;
singleJoyCon.buttons[0].pressed = true;
stepFrame();
check('Joy-Con L+R button 0 (A, right) is east; single Joy-Con keeps standard south', nintendoLog, [
  'press p1 east',
  'press p2 south',
]);
nintendoInput.destroy();



console.log('\n--- sticks ---');



function roundedStick(input, player, stick) {
  const { x, y } = input.stick(player, stick);
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}

const driftingPad = standardPad(0, 'Generic USB Joystick');
driftingPad.axes = [0.004, 0.004, 0.21, 0.004];
connectedPads = [driftingPad];
const stickInput = new Input();
stepFrame();
check('resting offset reads as centered', [roundedStick(stickInput, 1, Stick.left), roundedStick(stickInput, 1, Stick.right)], [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
]);
driftingPad.axes[2] = 1;
stepFrame();
check('full push toward the offset side still reaches 1', roundedStick(stickInput, 1, Stick.right).x, 1);
driftingPad.axes[2] = -1;
stepFrame();
check('full push away from the offset side reaches -1', roundedStick(stickInput, 1, Stick.right).x, -1);
driftingPad.axes[2] = 0.21;
driftingPad.axes[0] = 0.502;
stepFrame();
check('half push is scaled past the deadzone', roundedStick(stickInput, 1, Stick.left), { x: 0.412, y: 0 });
check('stick() returns zeros for an unknown player', stickInput.stick(9, Stick.left), { x: 0, y: 0 });
connectedPads = [];
gamepadEvent('gamepaddisconnected', driftingPad);
check('disconnect resets the stick', stickInput.stick(1, Stick.left), { x: 0, y: 0 });
stickInput.destroy();

const padHeldAtConnect = standardPad(0, 'Pad held at connect');
padHeldAtConnect.axes = [0.9, 0, 0, 0];
connectedPads = [padHeldAtConnect];
const heldAtConnectInput = new Input();
padHeldAtConnect.axes[0] = 0;
stepFrame();
check('stick held at connect is not taken as rest', roundedStick(heldAtConnectInput, 1, Stick.left).x, 0);
heldAtConnectInput.destroy();

const widerDeadzonePad = standardPad(0, 'Wider deadzone pad');
connectedPads = [widerDeadzonePad];
const widerDeadzoneInput = new Input({ stickDeadzone: 0.5 });
widerDeadzonePad.axes[0] = 0.4;
stepFrame();
check('stickDeadzone option ignores 0.4 when set to 0.5', roundedStick(widerDeadzoneInput, 1, Stick.left).x, 0);
widerDeadzoneInput.destroy();
connectedPads = [];



console.log('\n--- custom gamepad profiles ---');



const customPad = standardPad(0, 'Joy-Con (L/R) custom test');
connectedPads = [customPad];
const customProfileInput = new Input({
  gamepadProfiles: [{ matches: /custom test/, buttonByIndex: { 0: Button.north } }],
});
const customProfileLog = [];
customProfileInput.on(InputEvent.press, ({ button }) => customProfileLog.push(button));
customPad.buttons[0].pressed = true;
customPad.buttons[12].pressed = true;
stepFrame();
check('custom profile wins over built-in Joy-Con profile', customProfileLog[0], Button.north);
check('unlisted buttons keep the standard mapping', customProfileLog.includes(Button.up), true);
customProfileInput.destroy();
connectedPads = [];



console.log('\n--- GameLoop ---');



const scheduledFrames = new Map();
let nextFrameId = 1;
globalThis.requestAnimationFrame = (callback) => {
  scheduledFrames.set(nextFrameId, callback);
  return nextFrameId++;
};
globalThis.cancelAnimationFrame = (frameId) => scheduledFrames.delete(frameId);
function stepFrameAt(time) {
  const callbacks = [...scheduledFrames.values()];
  scheduledFrames.clear();
  callbacks.forEach((callback) => callback(time));
}

const secondsLog = [];
const gameLoop = new GameLoop((seconds) => secondsLog.push(Number(seconds.toFixed(3))));
check('does not run before start()', scheduledFrames.size, 0);
check('start() returns the loop for chaining', gameLoop.start() === gameLoop, true);
gameLoop.start();
check('start() twice schedules one frame', scheduledFrames.size, 1);
stepFrameAt(1000);
stepFrameAt(1016);
stepFrameAt(5000);
check('seconds: 0 first, then elapsed, capped at 0.1', secondsLog, [0, 0.016, 0.1]);
gameLoop.stop();
stepFrameAt(5016);
check('stop() halts updates', secondsLog.length, 3);
check('stop() leaves no frame scheduled', scheduledFrames.size, 0);
gameLoop.start();
stepFrameAt(9000);
check('start() after stop() resets timing', secondsLog.at(-1), 0);
gameLoop.stop();

const uncappedSecondsLog = [];
const uncappedLoop = new GameLoop((seconds) => uncappedSecondsLog.push(seconds), {
  maxSecondsPerFrame: Infinity,
}).start();
stepFrameAt(20000);
stepFrameAt(24000);
check('maxSecondsPerFrame: Infinity allows a 4-second step', uncappedSecondsLog, [0, 4]);
uncappedLoop.stop();

const selfStoppingLoop = new GameLoop(() => selfStoppingLoop.stop()).start();
stepFrameAt(10000);
check('stop() inside update leaves no frame scheduled', scheduledFrames.size, 0);

const restartingLoop = new GameLoop(() => restartingLoop.stop().start()).start();
stepFrameAt(11000);
check('stop().start() inside update keeps exactly one loop', scheduledFrames.size, 1);
restartingLoop.stop();



console.log('\n--- controller types and labels ---');



check('detects controller types from browser ids', [
  controllerTypeOf('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),
  controllerTypeOf('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'),
  controllerTypeOf('Joy-Con (L/R) (STANDARD GAMEPAD)'),
  controllerTypeOf('Generic   USB  Joystick   (STANDARD GAMEPAD Vendor: 0079 Product: 0006)'),
], [ControllerType.playstation, ControllerType.xbox, ControllerType.nintendo, ControllerType.generic]);
check('detects xbox-style vendors and firefox id format', [
  controllerTypeOf('Logitech Gamepad F310 (STANDARD GAMEPAD Vendor: 046d Product: c21d)'),
  controllerTypeOf('046d-c21d-Logitech Gamepad F310'),
  controllerTypeOf('054c-0ce6-Wireless Controller'),
  controllerTypeOf('2dc8-6001-8BitDo SN30 Pro'),
], [ControllerType.xbox, ControllerType.xbox, ControllerType.playstation, ControllerType.generic]);
check('south label per controller type', [
  buttonLabel(Button.south, ControllerType.playstation),
  buttonLabel(Button.south, ControllerType.xbox),
  buttonLabel(Button.south, ControllerType.nintendo),
  buttonLabel(Button.south, ControllerType.generic),
], ['cross', 'A', 'B', 'south']);
check('d-pad keeps its position name', buttonLabel(Button.up, ControllerType.playstation), 'up');

const labelledPad = standardPad(0, 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)');
connectedPads = [labelledPad];
const typedInput = new Input();
const connectTypes = [];
typedInput.on(InputEvent.connect, ({ type }) => connectTypes.push(type));
check('connect event (replayed) includes the controller type', connectTypes, [ControllerType.playstation]);
typedInput.destroy();
connectedPads = [];



console.log('\n--- remapping ---');



const remapInput = new Input({
  keyboard: { 1: { KeyW: Button.up, KeyS: Button.down }, 2: { ArrowUp: Button.up } },
  gamepads: false,
});
const remapLog = [];
remapInput
  .on(InputEvent.press, ({ player, button }) => remapLog.push(`press p${player} ${button}`))
  .on(InputEvent.release, ({ player, button }) => remapLog.push(`release p${player} ${button}`));
check('remap() returns the input for chaining', remapInput.remap(1, { [Button.up]: Button.south }) === remapInput, true);
key('keydown', 'KeyW');
check('remapped key produces the new button', remapLog.at(-1), 'press p1 south');
check('original button is not held', remapInput.isPressed(1, Button.up), false);
remapInput.remap(1, { [Button.up]: Button.east });
check('changing a remap releases held buttons first', remapLog.at(-1), 'release p1 south');
key('keyup', 'KeyW');
check('nothing left held after keyup', [remapInput.isPressed(1, Button.south), remapInput.isPressed(1, Button.east)], [false, false]);
remapInput.remap(1, { [Button.down]: Button.north });
check('remap() adds to existing remaps', remapInput.remapOf(1), { up: 'east', down: 'north' });
const remapCopy = remapInput.remapOf(1);
remapCopy.up = 'west';
check('remapOf() returns a copy', remapInput.remapOf(1).up, 'east');
remapInput.resetRemap(1);
remapLog.length = 0;
key('keydown', 'KeyW');
key('keyup', 'KeyW');
check('resetRemap(player) restores the original button', remapLog, ['press p1 up', 'release p1 up']);
remapInput.remap(1, { [Button.up]: Button.south }).remap(2, { [Button.up]: Button.south });
remapInput.resetRemap();
check('resetRemap() with no player resets everyone', [remapInput.remapOf(1), remapInput.remapOf(2)], [{}, {}]);
let unknownButtonError = null;
try { remapInput.remap(1, { up: 'jump' }); } catch (e) { unknownButtonError = e.message; }
check('unknown button name throws', unknownButtonError, 'Unknown button: "jump"');
remapInput.destroy();




console.log('\n--- nextPress ---');



const nextPressInput = new Input({
  keyboard: { 1: { KeyW: Button.up, KeyS: Button.down } },
  gamepads: false,
});
const nextPressLog = [];
nextPressInput
  .on(InputEvent.press, ({ player, button }) => nextPressLog.push(`press p${player} ${button}`))
  .on(InputEvent.release, ({ player, button }) => nextPressLog.push(`release p${player} ${button}`));
const firstNextPress = nextPressInput.nextPress(1);
check('nextPress() called twice returns the same promise', nextPressInput.nextPress(1) === firstNextPress, true);
key('keydown', 'KeyS');
check('nextPress() resolves with the pressed button', await firstNextPress, Button.down);
key('keyup', 'KeyS');
check('captured press and its release do not reach listeners', nextPressLog, []);

key('keydown', 'KeyW');
const pressWhileHolding = nextPressInput.nextPress(1);
key('keydown', 'KeyW');
key('keydown', 'KeyS');
check('a button already held does not count as the next press', await pressWhileHolding, Button.down);
key('keyup', 'KeyS');
key('keyup', 'KeyW');
check('the held button still presses and releases normally', nextPressLog, ['press p1 up', 'release p1 up']);

nextPressInput.remap(1, { [Button.up]: Button.south });
const pressBeforeRemap = nextPressInput.nextPress(1);
key('keydown', 'KeyW');
check('nextPress() gives the button before remapping', await pressBeforeRemap, Button.up);
key('keyup', 'KeyW');
nextPressInput.destroy();

const capturePad = standardPad(0, 'Capture pad');
connectedPads = [capturePad];
const gamepadNextPressInput = new Input();
const gamepadNextPressLog = [];
gamepadNextPressInput.on(InputEvent.press, ({ button }) => gamepadNextPressLog.push(button));
const gamepadNextPress = gamepadNextPressInput.nextPress(1);
capturePad.buttons[0].pressed = true;
stepFrameAt(30000);
stepFrameAt(30016);
check('gamepad nextPress() resolves with the pressed button', await gamepadNextPress, Button.south);
check('captured gamepad button held over frames does not reach listeners', gamepadNextPressLog, []);
capturePad.buttons[0].pressed = false;
stepFrameAt(30032);
capturePad.buttons[0].pressed = true;
stepFrameAt(30048);
check('after release, the same button presses normally', gamepadNextPressLog, [Button.south]);
gamepadNextPressInput.destroy();
connectedPads = [];

const remapPad = standardPad(0, 'Remap pad');
connectedPads = [remapPad];
const gamepadRemapInput = new Input();
const gamepadRemapLog = [];
gamepadRemapInput
  .on(InputEvent.press, ({ button }) => gamepadRemapLog.push(`press ${button}`))
  .on(InputEvent.release, ({ button }) => gamepadRemapLog.push(`release ${button}`));
gamepadRemapInput.remap(1, { [Button.east]: Button.south });
remapPad.buttons[1].pressed = true;
stepFrameAt(31000);
stepFrameAt(31016);
stepFrameAt(31032);
check('gamepad remap holds steady across frames', [gamepadRemapInput.isPressed(1, Button.south), gamepadRemapLog], [
  true,
  ['press south'],
]);
remapPad.buttons[0].pressed = true;
stepFrameAt(31048);
remapPad.buttons[1].pressed = false;
stepFrameAt(31064);
check('two buttons mapped to the same Button: still held until both let go', gamepadRemapInput.isPressed(1, Button.south), true);
remapPad.buttons[0].pressed = false;
stepFrameAt(31080);
check('released once both let go', gamepadRemapLog, ['press south', 'release south']);
gamepadRemapInput.destroy();
connectedPads = [];

const cancelInput = new Input({ keyboard: { 1: { KeyW: Button.up } }, gamepads: false });
const cancelLog = [];
cancelInput.on(InputEvent.press, ({ button }) => cancelLog.push(button));
const cancelledNextPress = cancelInput.nextPress(1);
check('cancelNextPress() returns the input for chaining', cancelInput.cancelNextPress(1) === cancelInput, true);
check('cancelled nextPress() resolves with null', await cancelledNextPress, null);
key('keydown', 'KeyW');
key('keyup', 'KeyW');
check('presses after cancelling reach listeners normally', cancelLog, [Button.up]);
const nextPressBeforeDestroy = cancelInput.nextPress(1);
cancelInput.destroy();
check('destroy() resolves a waiting nextPress() with null', await nextPressBeforeDestroy, null);

const disconnectingPad = standardPad(0, 'Disconnecting pad');
connectedPads = [disconnectingPad];
const disconnectInput = new Input();
const nextPressBeforeDisconnect = disconnectInput.nextPress(1);
connectedPads = [];
gamepadEvent('gamepaddisconnected', disconnectingPad);
check('disconnect resolves a waiting nextPress() with null', await nextPressBeforeDisconnect, null);
disconnectInput.destroy();




console.log('\n--- duplicate Joy-Con pair ---');



const plusPairId = 'Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)';
const slashPairId = 'Joy-Con (L/R) (STANDARD GAMEPAD)';

const plusPairFirst = standardPad(0, plusPairId);
const slashPairSecond = standardPad(1, slashPairId);
connectedPads = [plusPairFirst];
const plusPairFirstInput = new Input();
const plusPairFirstLog = [];
plusPairFirstInput
  .on(InputEvent.connect, ({ player }) => plusPairFirstLog.push(`connect p${player}`))
  .on(InputEvent.press, ({ player, button }) => plusPairFirstLog.push(`press p${player} ${button}`));
connectedPads = [plusPairFirst, slashPairSecond];
gamepadEvent('gamepadconnected', slashPairSecond);
slashPairSecond.buttons[12].pressed = true;
stepFrameAt(40000);
check('L+R first, then (L/R): two players (one per half), and (L/R) is ignored', plusPairFirstLog, ['connect p1', 'connect p2']);
check('a console note explains the ignored duplicate', infos.at(-1), `ignoring gamepad "${slashPairId}" because the same Joy-Con pair is also listed as "Joy-Con L+R"`);
connectedPads = [plusPairFirst];
gamepadEvent('gamepaddisconnected', slashPairSecond);
plusPairFirst.buttons[12].pressed = true;
stepFrameAt(40016);
check('an ignored entry disconnecting does not remove the players', plusPairFirstLog, ['connect p1', 'connect p2', 'press p1 north']);
plusPairFirstInput.destroy();

const slashPairFirst = standardPad(0, slashPairId);
const plusPairSecond = standardPad(1, plusPairId);
connectedPads = [slashPairFirst];
const slashPairFirstInput = new Input();
const slashPairFirstLog = [];
slashPairFirstInput
  .on(InputEvent.connect, ({ player }) => slashPairFirstLog.push(`connect p${player}`))
  .on(InputEvent.press, ({ player, button }) => slashPairFirstLog.push(`press p${player} ${button}`));
connectedPads = [slashPairFirst, plusPairSecond];
gamepadEvent('gamepadconnected', plusPairSecond);
slashPairFirst.buttons[12].pressed = true;
stepFrameAt(41000);
plusPairSecond.buttons[13].pressed = true;
stepFrameAt(41016);
check("(L/R) first, then L+R: (L/R)'s player is kept, one is added, and L+R takes over input", slashPairFirstLog, ['connect p1', 'connect p2', 'press p1 south']);
slashPairFirstInput.destroy();

const slashPairOnly = standardPad(0, slashPairId);
connectedPads = [slashPairOnly];
const slashPairOnlyInput = new Input();
const slashPairOnlyLog = [];
slashPairOnlyInput.on(InputEvent.press, ({ player, button }) => slashPairOnlyLog.push(`press p${player} ${button}`));
slashPairOnly.buttons[12].pressed = true;
stepFrameAt(42000);
check('(L/R) on its own is used normally', slashPairOnlyLog, ['press p1 up']);
slashPairOnlyInput.destroy();
connectedPads = [];




console.log('\n--- split Joy-Con pair ---');



const splitPair = standardPad(0, plusPairId);
connectedPads = [splitPair];
const splitInput = new Input();
const splitLog = [];
splitInput
  .on(InputEvent.connect, ({ player }) => splitLog.push(`connect p${player}`))
  .on(InputEvent.disconnect, ({ player }) => splitLog.push(`disconnect p${player}`))
  .on(InputEvent.press, ({ player, button }) => splitLog.push(`press p${player} ${button}`));
check('one L+R pad gives two players', splitLog, ['connect p1', 'connect p2']);

function pressOnlyAndStep(pressedIndexes, time) {
  splitPair.buttons.forEach((button, index) => (button.pressed = pressedIndexes.includes(index)));
  splitLog.length = 0;
  stepFrameAt(time);
  return splitLog.filter((entry) => entry.startsWith('press'));
}
check('left half: arrows are face buttons, L is leftShoulder', pressOnlyAndStep([12, 13, 14, 15, 4], 43000), [
  'press p1 leftShoulder',
  'press p1 north',
  'press p1 south',
  'press p1 west',
  'press p1 east',
]);
check('right half: B / A / Y / X are face buttons, R is leftShoulder', pressOnlyAndStep([0, 1, 2, 3, 5], 43016), [
  'press p2 south',
  'press p2 east',
  'press p2 west',
  'press p2 north',
  'press p2 leftShoulder',
]);
splitPair.axes = [0.9, 0, 0, -0.9];
stepFrameAt(43032);
check('each half\'s stick is that player\'s Stick.left', [
  splitInput.stick(1, Stick.left).x > 0.8,
  splitInput.stick(2, Stick.left).y < -0.8,
], [true, true]);
splitLog.length = 0;
connectedPads = [];
gamepadEvent('gamepaddisconnected', splitPair);
check('disconnecting the pad disconnects both players', splitLog.filter((entry) => entry.startsWith('disconnect')), [
  'disconnect p1',
  'disconnect p2',
]);
splitInput.destroy();



console.log('\n---------------------');
console.log('---------------------');
console.log(failures ? `❌ ${failures}/${passes} failures` : `✅ all ${[passes]} passed`);
process.exitCode = failures ? 1 : 0;
console.log('---------------------');
console.log('---------------------');
