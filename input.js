import { listenToKeyboard } from './keyboard.js';
import { listenToGamepads } from './gamepad.js';
import { controllerTypeOf } from './labels.js';
import { Button } from './button.js';

export { Key } from './keyboard.js';
export { Button } from './button.js';
export { Stick } from './stick.js';
export { GameLoop } from './gameloop.js';
export { ControllerType, controllerTypeOf, buttonLabel } from './labels.js';

export const InputEvent = Object.freeze({
  press: 'press',
  release: 'release',
  connect: 'connect',
  disconnect: 'disconnect',
});

const knownEventTypes = new Set(Object.values(InputEvent));
const knownButtons = new Set(Object.values(Button));

export class Input {
  #stopListeningToKeyboard = () => {};
  #stopListeningToGamepads = () => {};
  #listeners = new Map();
  #pressedButtons = new Map();
  #connectedPlayers = new Map();
  #stickPositions = new Map();
  #remapByPlayer = new Map();
  #pendingNextPressByPlayer = new Map();
  #capturedButtonsByPlayer = new Map();
  #heldSourceButtonsByPlayer = new Map();

  constructor({ keyboard, gamepads = true, stickDeadzone = 0.15, gamepadProfiles = [] } = {}) {
    const sourceCallbacks = {
      press: (player, button) => this.#pressFromSource(player, button),
      release: (player, button) => this.#releaseFromSource(player, button),
      connect: (player, id) => this.#connect(player, id),
      disconnect: (player, id) => this.#disconnect(player, id),
      moveStick: (player, stick, x, y) => this.#moveStick(player, stick, x, y),
    };
    if (keyboard) {
      this.#stopListeningToKeyboard = listenToKeyboard(keyboard, sourceCallbacks);
    }
    if (gamepads) {
      this.#stopListeningToGamepads = listenToGamepads({
        playersTakenByKeyboard: Object.keys(keyboard ?? {}).map(Number),
        stickDeadzone,
        customProfiles: gamepadProfiles,
        ...sourceCallbacks,
      });
    }
  }

  /** throws error on unknown input event type */
  on(eventType, listener) {
    if (!knownEventTypes.has(eventType)) {
      throw new Error(`Unknown input event type: "${eventType}"`);
    }
    if (!this.#listeners.has(eventType)) {
      this.#listeners.set(eventType, new Set());
    }
    this.#listeners.get(eventType).add(listener);
    if (eventType === InputEvent.connect) {
      this.#connectedPlayers.forEach(({ id, type }, player) => listener({ player, id, type }));
    }
    return this;
  }

  off(eventType, listener) {
    this.#listeners.get(eventType)?.delete(listener);
    return this;
  }

  isPressed(player, button) {
    return this.#buttonsHeldBy(player).has(button);
  }

  stick(player, stick) {
    return { ...(this.#stickPositions.get(player)?.[stick] ?? { x: 0, y: 0 }) };
  }

  /** adds to the player's existing remaps. throws error on unknown button names */
  remap(player, toButtonByFromButton) {
    for (const [fromButton, toButton] of Object.entries(toButtonByFromButton)) {
      if (!knownButtons.has(fromButton)) throw new Error(`Unknown button: "${fromButton}"`);
      if (!knownButtons.has(toButton)) throw new Error(`Unknown button: "${toButton}"`);
    }
    this.#releaseHeldButtonsOf(player);
    this.#remapByPlayer.set(player, { ...this.remapOf(player), ...toButtonByFromButton });
    return this;
  }

  /** undoes the player's remaps, or everyone's if no player is given */
  resetRemap(player) {
    const players = player === undefined ? [...this.#remapByPlayer.keys()] : [player];
    for (const playerToReset of players) {
      this.#releaseHeldButtonsOf(playerToReset);
      this.#remapByPlayer.delete(playerToReset);
    }
    return this;
  }

  remapOf(player) {
    return { ...this.#remapByPlayer.get(player) };
  }

  /** resolves with the next button the player newly presses, before remapping. that press doesn't reach listeners */
  nextPress(player) {
    if (!this.#pendingNextPressByPlayer.has(player)) {
      let resolve;
      const promise = new Promise((resolvePromise) => (resolve = resolvePromise));
      this.#pendingNextPressByPlayer.set(player, { promise, resolve });
    }
    return this.#pendingNextPressByPlayer.get(player).promise;
  }

  /** makes the player's waiting nextPress() resolve with null */
  cancelNextPress(player) {
    this.#pendingNextPressByPlayer.get(player)?.resolve(null);
    this.#pendingNextPressByPlayer.delete(player);
    return this;
  }

  destroy() {
    this.#stopListeningToKeyboard();
    this.#stopListeningToGamepads();
    this.#listeners.clear();
    this.#pressedButtons.clear();
    this.#connectedPlayers.clear();
    this.#stickPositions.clear();
    this.#remapByPlayer.clear();
    this.#pendingNextPressByPlayer.forEach(({ resolve }) => resolve(null));
    this.#pendingNextPressByPlayer.clear();
    this.#capturedButtonsByPlayer.clear();
    this.#heldSourceButtonsByPlayer.clear();
  }

  #pressFromSource(player, sourceButton) {
    if (this.#capturedButtonsOf(player).has(sourceButton)) return;
    const heldSourceButtons = this.#heldSourceButtonsOf(player);
    const pendingNextPress = this.#pendingNextPressByPlayer.get(player);
    if (pendingNextPress && !heldSourceButtons.has(sourceButton)) {
      this.#pendingNextPressByPlayer.delete(player);
      this.#capturedButtonsOf(player).add(sourceButton);
      pendingNextPress.resolve(sourceButton);
      return;
    }
    heldSourceButtons.add(sourceButton);
    this.#press(player, this.#remapped(player, sourceButton));
  }

  #releaseFromSource(player, sourceButton) {
    if (this.#capturedButtonsOf(player).delete(sourceButton)) return;
    const heldSourceButtons = this.#heldSourceButtonsOf(player);
    if (!heldSourceButtons.delete(sourceButton)) return;
    const button = this.#remapped(player, sourceButton);
    const isStillHeldByAnotherSource = [...heldSourceButtons].some(
      (otherSourceButton) => this.#remapped(player, otherSourceButton) === button,
    );
    if (!isStillHeldByAnotherSource) this.#release(player, button);
  }

  #heldSourceButtonsOf(player) {
    if (!this.#heldSourceButtonsByPlayer.has(player)) {
      this.#heldSourceButtonsByPlayer.set(player, new Set());
    }
    return this.#heldSourceButtonsByPlayer.get(player);
  }

  #capturedButtonsOf(player) {
    if (!this.#capturedButtonsByPlayer.has(player)) {
      this.#capturedButtonsByPlayer.set(player, new Set());
    }
    return this.#capturedButtonsByPlayer.get(player);
  }

  #press(player, button) {
    const buttons = this.#buttonsHeldBy(player);
    if (buttons.has(button)) return;
    buttons.add(button);
    this.#notifyListeners(InputEvent.press, { player, button });
  }

  #release(player, button) {
    const buttons = this.#buttonsHeldBy(player);
    if (!buttons.has(button)) return;
    buttons.delete(button);
    this.#notifyListeners(InputEvent.release, { player, button });
  }

  #connect(player, id) {
    const type = controllerTypeOf(id);
    this.#connectedPlayers.set(player, { id, type });
    this.#notifyListeners(InputEvent.connect, { player, id, type });
  }

  #disconnect(player, id) {
    this.#releaseHeldButtonsOf(player);
    this.cancelNextPress(player);
    this.#capturedButtonsByPlayer.delete(player);
    this.#connectedPlayers.delete(player);
    this.#stickPositions.delete(player);
    this.#notifyListeners(InputEvent.disconnect, { player, id });
  }

  #moveStick(player, stick, x, y) {
    if (!this.#stickPositions.has(player)) this.#stickPositions.set(player, {});
    this.#stickPositions.get(player)[stick] = { x, y };
  }

  #remapped(player, button) {
    return this.#remapByPlayer.get(player)?.[button] ?? button;
  }

  #releaseHeldButtonsOf(player) {
    this.#heldSourceButtonsByPlayer.delete(player);
    this.#buttonsHeldBy(player).forEach((button) => this.#release(player, button));
  }

  #notifyListeners(eventType, detail) {
    this.#listeners.get(eventType)?.forEach((listener) => listener(detail));
  }

  #buttonsHeldBy(player) {
    if (!this.#pressedButtons.has(player)) {
      this.#pressedButtons.set(player, new Set());
    }
    return this.#pressedButtons.get(player);
  }
}
