import { Button } from './button.js';
import { Stick } from './stick.js';

const buttonByStandardIndex = Object.freeze({
  0: Button.south,
  1: Button.east,
  2: Button.west,
  3: Button.north,
  4: Button.leftShoulder,
  5: Button.rightShoulder,
  6: Button.leftTrigger,
  7: Button.rightTrigger,
  8: Button.select,
  9: Button.start,
  10: Button.leftStickPress,
  11: Button.rightStickPress,
  12: Button.up,
  13: Button.down,
  14: Button.left,
  15: Button.right,
  16: Button.home,
});

const buttonByNintendoIndex = Object.freeze({
  ...buttonByStandardIndex,
  0: Button.east,
  1: Button.south,
  2: Button.north,
  3: Button.west,
});

const profiles = [
  { matches: /Joy-Con \(L\/R\)|Pro Controller/i, buttonByIndex: buttonByNintendoIndex },
];

const standardAxisIndexesByStick = Object.freeze({
  [Stick.left]: { x: 0, y: 1 },
  [Stick.right]: { x: 2, y: 3 },
});

const maxRestingOffset = 0.35;

function restingAxesOf(gamepad) {
  return gamepad.axes.map((value) => (Math.abs(value) < maxRestingOffset ? value : 0));
}

function centeredAxis(value, resting) {
  return value >= resting ? (value - resting) / (1 - resting) : (value - resting) / (1 + resting);
}

function applyDeadzone(x, y, deadzone) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const scaledMagnitude = Math.min((magnitude - deadzone) / (1 - deadzone), 1);
  const shrinkFactor = scaledMagnitude / magnitude;
  return { x: x * shrinkFactor, y: y * shrinkFactor };
}


const preferredJoyConPairId = /Joy-Con L\+R/;
const duplicateJoyConPairId = /Joy-Con \(L\/R\)/;

// each Joy-Con half is always reported as a small standard controller (held upright),
// regardless of whether it thinks it's a connected pair or separate,
// so its only stick is Stick.left and its main shoulder is leftShoulder
const joyConLeftHalf = {
  buttonByIndex: {
    12: Button.north,
    13: Button.south,
    14: Button.west,
    15: Button.east,
    4: Button.leftShoulder,
    6: Button.leftTrigger,
    8: Button.start,
    10: Button.leftStickPress,
  },
  axisIndexesByStick: { [Stick.left]: { x: 0, y: 1 } },
};
const joyConRightHalf = {
  buttonByIndex: {
    0: Button.south,
    1: Button.east,
    2: Button.west,
    3: Button.north,
    5: Button.leftShoulder,
    7: Button.leftTrigger,
    9: Button.start,
    11: Button.leftStickPress,
    16: Button.home,
  },
  axisIndexesByStick: { [Stick.left]: { x: 2, y: 3 } },
};

// single Joy-Cons (2006 = left, 2007 = right), guessed to use the same button numbers as in a pair
// to switch this off, set the list to []. to match other controller ids, edit the patterns below
const singleJoyConHalves = [
  [/Joy-Con \(L\)|Product: 2006|^057e-2006-/i, joyConLeftHalf],
  [/Joy-Con \(R\)|Product: 2007|^057e-2007-/i, joyConRightHalf],
];

export function listenToGamepads({
  playersTakenByKeyboard,
  press,
  release,
  connect,
  disconnect,
  moveStick = () => {},
  stickDeadzone = 0.15,
  customProfiles = [],
}) {
  const customProfilesOnTopOfStandard = customProfiles.map(({ matches, buttonByIndex }) => ({
    matches,
    buttonByIndex: { ...buttonByStandardIndex, ...buttonByIndex },
  }));
  const profilesInPriorityOrder = [...customProfilesOnTopOfStandard, ...profiles];
  const playersByGamepadIndex = new Map();
  const restingAxesByGamepadIndex = new Map();
  const gamepadIdByIndex = new Map();
  const ignoredDuplicateGamepadIndexes = new Set();
  let animationFrameId = null;

  function buttonMapFor(gamepad) {
    return (
      profilesInPriorityOrder.find(({ matches }) => matches.test(gamepad.id))?.buttonByIndex ??
      buttonByStandardIndex
    );
  }

  function playerCountOf(gamepad) {
    return preferredJoyConPairId.test(gamepad.id) ? 2 : 1;
  }

  function playersFor(gamepad, playerNumbers) {
    if (preferredJoyConPairId.test(gamepad.id)) {
      return [
        { player: playerNumbers[0], ...joyConLeftHalf },
        { player: playerNumbers[1], ...joyConRightHalf },
      ];
    }
    const singleJoyConHalf = singleJoyConHalves.find(([idPattern]) => idPattern.test(gamepad.id))?.[1];
    if (singleJoyConHalf) return [{ player: playerNumbers[0], ...singleJoyConHalf }];
    return [
      { player: playerNumbers[0], buttonByIndex: buttonMapFor(gamepad), axisIndexesByStick: standardAxisIndexesByStick },
    ];
  }

  function lowestFreePlayers(count, alsoTaken = []) {
    const gamepadPlayers = [...playersByGamepadIndex.values()].flat().map(({ player }) => player);
    const takenPlayers = new Set([...playersTakenByKeyboard, ...gamepadPlayers, ...alsoTaken]);
    const freePlayers = [];
    for (let player = 1; freePlayers.length < count; player++) {
      if (!takenPlayers.has(player)) freePlayers.push(player);
    }
    return freePlayers;
  }

  function trackGamepad(gamepad, players) {
    playersByGamepadIndex.set(gamepad.index, players);
    restingAxesByGamepadIndex.set(gamepad.index, restingAxesOf(gamepad));
    gamepadIdByIndex.set(gamepad.index, gamepad.id);
  }

  function untrackGamepad(gamepadIndex) {
    playersByGamepadIndex.delete(gamepadIndex);
    restingAxesByGamepadIndex.delete(gamepadIndex);
    gamepadIdByIndex.delete(gamepadIndex);
  }

  function ignoreDuplicate(gamepadIndex, id) {
    ignoredDuplicateGamepadIndexes.add(gamepadIndex);
    console.info(`ignoring gamepad "${id}" because the same Joy-Con pair is also listed as "Joy-Con L+R"`);
  }

  function isConnected(idPattern) {
    return [...gamepadIdByIndex.values()].some((id) => idPattern.test(id));
  }

  function addGamepad(gamepad) {
    if (playersByGamepadIndex.has(gamepad.index) || ignoredDuplicateGamepadIndexes.has(gamepad.index)) return;
    if (duplicateJoyConPairId.test(gamepad.id) && isConnected(preferredJoyConPairId)) {
      ignoreDuplicate(gamepad.index, gamepad.id);
      return;
    }
    if (preferredJoyConPairId.test(gamepad.id)) {
      const duplicateIndex = [...gamepadIdByIndex].find(([, id]) => duplicateJoyConPairId.test(id))?.[0];
      if (duplicateIndex !== undefined) {
        const duplicateId = gamepadIdByIndex.get(duplicateIndex);
        const keptPlayers = playersByGamepadIndex.get(duplicateIndex).map(({ player }) => player);
        untrackGamepad(duplicateIndex);
        ignoreDuplicate(duplicateIndex, duplicateId);
        const addedPlayers = lowestFreePlayers(playerCountOf(gamepad) - keptPlayers.length, keptPlayers);
        trackGamepad(gamepad, playersFor(gamepad, [...keptPlayers, ...addedPlayers]));
        addedPlayers.forEach((player) => connect(player, gamepad.id));
        return;
      }
    }
    const players = playersFor(gamepad, lowestFreePlayers(playerCountOf(gamepad)));
    trackGamepad(gamepad, players);
    if (gamepad.mapping !== 'standard') {
      console.warn(
        `this browser reports gamepad "${gamepad.id}" with a non-standard layout, so its buttons and sticks are ignored. a browser like Chrome may recognize it`,
      );
    }
    players.forEach(({ player }) => connect(player, gamepad.id));
    startPolling();
  }

  function removeGamepad(gamepad) {
    if (ignoredDuplicateGamepadIndexes.delete(gamepad.index)) return;
    const players = playersByGamepadIndex.get(gamepad.index);
    if (players === undefined) return;
    untrackGamepad(gamepad.index);
    players.forEach(({ player }) => disconnect(player, gamepad.id));
  }

  function pollButtons() {
    if (playersByGamepadIndex.size === 0) {
      animationFrameId = null;
      return;
    }
    for (const gamepad of navigator.getGamepads()) {
      const players = playersByGamepadIndex.get(gamepad?.index);
      if (players === undefined || gamepad.mapping !== 'standard') continue;
      const restingAxes = restingAxesByGamepadIndex.get(gamepad.index) ?? [];
      for (const { player, buttonByIndex, axisIndexesByStick } of players) {
        for (const [index, button] of Object.entries(buttonByIndex)) {
          if (gamepad.buttons[index]?.pressed) press(player, button);
          else release(player, button);
        }
        for (const [stick, axisIndexes] of Object.entries(axisIndexesByStick)) {
          const centeredX = centeredAxis(gamepad.axes[axisIndexes.x] ?? 0, restingAxes[axisIndexes.x] ?? 0);
          const centeredY = centeredAxis(gamepad.axes[axisIndexes.y] ?? 0, restingAxes[axisIndexes.y] ?? 0);
          const { x, y } = applyDeadzone(centeredX, centeredY, stickDeadzone);
          moveStick(player, stick, x, y);
        }
      }
    }
    animationFrameId = requestAnimationFrame(pollButtons);
  }

  function startPolling() {
    animationFrameId ??= requestAnimationFrame(pollButtons);
  }

  const onGamepadConnected = ({ gamepad }) => addGamepad(gamepad);
  const onGamepadDisconnected = ({ gamepad }) => removeGamepad(gamepad);

  window.addEventListener('gamepadconnected', onGamepadConnected);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
  navigator.getGamepads?.().filter(Boolean).forEach(addGamepad);

  return function stopListeningToGamepads() {
    window.removeEventListener('gamepadconnected', onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    playersByGamepadIndex.clear();
    restingAxesByGamepadIndex.clear();
    gamepadIdByIndex.clear();
    ignoredDuplicateGamepadIndexes.clear();
  };
}
