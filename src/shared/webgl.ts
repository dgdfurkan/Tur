/** Whether this browser can create the WebGL 2 context the 3D map needs. */
export function supportsWebGL(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
