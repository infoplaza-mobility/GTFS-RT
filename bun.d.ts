// Bun type declarations for TypeScript compilation
// This file ensures TypeScript recognizes Bun-specific modules and globals

declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: any): {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    [key: string]: any;
  };
}

