const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const digits = '0123456789'.split('');
const functionKeys = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);

export const Key = Object.freeze({
  ...Object.fromEntries(letters.map((l) => [l, `Key${l}`])),
  ...Object.fromEntries(digits.map((d) => [`Digit${d}`, `Digit${d}`])),
  ...Object.fromEntries(functionKeys.map((f) => [f, f])),
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  ShiftLeft: 'ShiftLeft',
  ShiftRight: 'ShiftRight',
  AltLeft: 'AltLeft',
  AltRight: 'AltRight',
});

const knownKeyCodes = new Set(Object.values(Key));

function throwOnUnknownKeyCodes(buttonsByKeyCodeByPlayer) {
  for (const buttonsByKeyCode of Object.values(buttonsByKeyCodeByPlayer)) {
    for (const keyCode of Object.keys(buttonsByKeyCode)) {
      if (!knownKeyCodes.has(keyCode)) {
        throw new Error(`Unknown key code: "${keyCode}"`);
      }
    }
  }
}

/** throws error on unknown key code */
export function listenToKeyboard(buttonsByKeyCodeByPlayer, { press, release }) {
  throwOnUnknownKeyCodes(buttonsByKeyCodeByPlayer);
  const heldKeyCodes = new Set();

  function findMapping(keyCode) {
    for (const [player, buttonsByKeyCode] of Object.entries(buttonsByKeyCodeByPlayer)) {
      const button = buttonsByKeyCode[keyCode];
      if (button) return { player: Number(player), button };
    }
    return null;
  }

  function onKeyDown(event) {
    const mapping = findMapping(event.code);
    if (!mapping) return;
    event.preventDefault();
    heldKeyCodes.add(event.code);
    press(mapping.player, mapping.button);
  }

  function onKeyUp(event) {
    const mapping = findMapping(event.code);
    if (!mapping) return;
    heldKeyCodes.delete(event.code);
    release(mapping.player, mapping.button);
  }

  function releaseAllHeldKeys() {
    heldKeyCodes.forEach((keyCode) => {
      const { player, button } = findMapping(keyCode);
      release(player, button);
    });
    heldKeyCodes.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAllHeldKeys);

  return function stopListeningToKeyboard() {
    releaseAllHeldKeys();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseAllHeldKeys);
  };
}
