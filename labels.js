import { Button } from './button.js';

export const ControllerType = Object.freeze({
  playstation: 'playstation',
  xbox: 'xbox',
  nintendo: 'nintendo',
  generic: 'generic',
});

const vendor = (ids) => new RegExp(`Vendor: (${ids})|^(${ids})-`, 'i');

const controllerTypePatterns = [
  [ControllerType.playstation, /DualSense|DualShock/i, vendor('054c')],
  [ControllerType.xbox, /Xbox/i, vendor('045e|046d|1532|18d1|1949|28de|0955')],
  [ControllerType.nintendo, /Joy-Con|Pro Controller/i, vendor('057e')],
];

export function controllerTypeOf(id) {
  return (
    controllerTypePatterns.find(([, namePattern, vendorPattern]) => namePattern.test(id) || vendorPattern.test(id))?.[0] ??
    ControllerType.generic
  );
}

const labelByButtonByControllerType = Object.freeze({
  [ControllerType.playstation]: Object.freeze({
    [Button.south]: 'cross',
    [Button.east]: 'circle',
    [Button.west]: 'square',
    [Button.north]: 'triangle',
    [Button.leftShoulder]: 'L1',
    [Button.rightShoulder]: 'R1',
    [Button.leftTrigger]: 'L2',
    [Button.rightTrigger]: 'R2',
    [Button.leftStickPress]: 'L3',
    [Button.rightStickPress]: 'R3',
    [Button.select]: 'create',
    [Button.start]: 'options',
    [Button.home]: 'PS',
  }),
  [ControllerType.xbox]: Object.freeze({
    [Button.south]: 'A',
    [Button.east]: 'B',
    [Button.west]: 'X',
    [Button.north]: 'Y',
    [Button.leftShoulder]: 'LB',
    [Button.rightShoulder]: 'RB',
    [Button.leftTrigger]: 'LT',
    [Button.rightTrigger]: 'RT',
    [Button.leftStickPress]: 'LS',
    [Button.rightStickPress]: 'RS',
    [Button.select]: 'view',
    [Button.start]: 'menu',
    [Button.home]: 'Xbox',
  }),
  [ControllerType.nintendo]: Object.freeze({
    [Button.south]: 'B',
    [Button.east]: 'A',
    [Button.west]: 'Y',
    [Button.north]: 'X',
    [Button.leftShoulder]: 'L',
    [Button.rightShoulder]: 'R',
    [Button.leftTrigger]: 'ZL',
    [Button.rightTrigger]: 'ZR',
    [Button.leftStickPress]: 'L stick',
    [Button.rightStickPress]: 'R stick',
    [Button.select]: 'minus',
    [Button.start]: 'plus',
    [Button.home]: 'home',
  }),
});

export function buttonLabel(button, controllerType) {
  return labelByButtonByControllerType[controllerType]?.[button] ?? button;
}
