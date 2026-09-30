/**
 * Colours of the place illustrations. They are written as literals rather than
 * CSS variables because the same drawings are also painted onto a canvas for
 * video export, where the page's style sheet does not reach.
 */
export const ink = {
  skyDay: '#cfe6f5',
  skyPale: '#e4f0f8',
  skyWarm: '#fbe6c6',
  skyDusk: '#f2c7a5',
  skyNight: '#31466b',
  sun: '#ffd66b',
  sunPale: '#fff3c4',
  cloud: '#ffffff',
  haze: '#e9eef2',

  farBlue: '#a9c4da',
  farGreen: '#b7cfae',
  farSand: '#e6cfae',

  sand: '#ead2a4',
  sandDeep: '#d9b57e',
  steppe: '#dccb93',
  grass: '#9cc57f',
  grassDeep: '#6fa45c',
  forest: '#3f7d4a',
  forestDeep: '#2c6239',

  tuff: '#efd8b8',
  tuffShade: '#d8b48a',
  tuffCap: '#9a7758',
  rock: '#c9a67a',
  rockShade: '#a5825c',
  rockDeep: '#7d6248',
  cliff: '#9c9488',
  cliffShade: '#7f776c',

  stone: '#e3cfa8',
  stoneShade: '#c4aa7c',
  stoneDeep: '#9f8459',
  marble: '#f1ebdc',
  marbleShade: '#d6cdb6',

  wall: '#f7f1e3',
  wallShade: '#e0d6c0',
  roof: '#b8553d',
  roofShade: '#94402e',
  wood: '#7a5a3c',
  woodDeep: '#553c28',
  clay: '#c96f4a',
  clayDeep: '#a4512f',

  water: '#7fc0e6',
  waterDeep: '#4f9fd0',
  sea: '#5aa9d6',
  seaDeep: '#2f7fb5',
  pool: '#8fd9d4',
  foam: '#ffffff',
  salt: '#f8ece6',
  saltShade: '#ead9d0',

  asphalt: '#2b3138',
  line: '#ffffff',
  blue: '#0b5a8f',
  brown: '#74462a',
  yellow: '#f2b705',
  red: '#c0161c',
  glass: '#22303c',
  lit: '#ffd66b',
  pink: '#f29cb0',
  dark: '#1b1f24',
} as const;
