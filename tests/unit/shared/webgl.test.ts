import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer, mapChoice } from '@/shared/webgl';

describe('mapChoice', () => {
  it('leaves the decision to the device unless the address asks for a map', () => {
    expect(mapChoice('')).toBe('auto');
    expect(mapChoice('?harita=baska')).toBe('auto');
    expect(mapChoice('?sayfa=2')).toBe('auto');
  });

  it('honours a request for the flat or the 3D map', () => {
    expect(mapChoice('?harita=duz')).toBe('flat');
    expect(mapChoice('?harita=3b')).toBe('3d');
    expect(mapChoice('?x=1&harita=duz')).toBe('flat');
  });
});

describe('isSoftwareRenderer', () => {
  it('recognises renderers that draw on the processor', () => {
    const software = [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Apple Software Renderer',
    ];
    for (const name of software) expect(isSoftwareRenderer(name), name).toBe(true);
  });

  it('accepts graphics chips', () => {
    const chips = [
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
      'Adreno (TM) 730',
      'Mali-G78',
      'Apple GPU',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ];
    for (const name of chips) expect(isSoftwareRenderer(name), name).toBe(false);
  });
});
