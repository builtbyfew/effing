declare module "pixelmatch" {
  interface PixelmatchOptions {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    aaColor?: [number, number, number];
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    diffMask?: boolean;
  }

  function pixelmatch(
    img1: Uint8Array | Uint8ClampedArray | Buffer,
    img2: Uint8Array | Uint8ClampedArray | Buffer,
    output: Uint8Array | Uint8ClampedArray | Buffer | null,
    width: number,
    height: number,
    options?: PixelmatchOptions,
  ): number;

  export default pixelmatch;
}

declare module "pngjs" {
  interface PNGOptions {
    width?: number;
    height?: number;
    fill?: boolean;
    filterType?: number;
  }

  interface PNGData {
    data: Buffer;
    width: number;
    height: number;
  }

  class PNG {
    data: Buffer;
    width: number;
    height: number;
    constructor(options?: PNGOptions);
    static sync: {
      read(buffer: Buffer): PNGData;
      write(png: PNG | PNGData): Buffer;
    };
  }

  export { PNG };
}
