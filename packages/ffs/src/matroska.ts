/**
 * Just enough of a Matroska writer to stream JPEG frames to FFmpeg as
 * several video tracks of one file (see AnnieExtraction.feed()).
 *
 * The stream is a Segment of unknown size (it's written as the frames come),
 * with an Info, a Tracks element of `trackCount` V_MJPEG tracks, and one
 * Cluster per frame holding a single keyframe SimpleBlock. Timestamps are in
 * milliseconds (the default TimestampScale).
 */

/** An EBML element size of 8 bytes. */
function size(n: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeUInt32BE(n % 0x100000000, 4);
  b.writeUInt32BE(Math.floor(n / 0x100000000), 0);
  b[0] = 0x01; // 8-byte length marker (sizes stay far below 2^56)
  return b;
}

/** An unsigned integer in as few bytes as it takes. */
function uint(n: number): Buffer {
  const bytes: number[] = [];
  do {
    bytes.unshift(n % 256);
    n = Math.floor(n / 256);
  } while (n > 0);
  return Buffer.from(bytes);
}

function element(id: number[], payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from(id), size(payload.length), payload]);
}

const UNKNOWN_SIZE = Buffer.from([1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

/**
 * Everything up to the first frame: EBML header, Segment start, Info, and
 * Tracks, whose frames each last `frameDurationNs` (the demuxer gives the
 * frames that duration, rounded to milliseconds).
 */
export function matroskaHeader(
  trackCount: number,
  frameDurationNs: number,
): Buffer {
  if (trackCount < 1 || trackCount > 126) {
    throw new Error(`Unsupported Matroska track count ${trackCount}`);
  }
  const ebml = element(
    [0x1a, 0x45, 0xdf, 0xa3],
    Buffer.concat([
      element([0x42, 0x86], uint(1)), // EBMLVersion
      element([0x42, 0xf7], uint(1)), // EBMLReadVersion
      element([0x42, 0xf2], uint(4)), // EBMLMaxIDLength
      element([0x42, 0xf3], uint(8)), // EBMLMaxSizeLength
      element([0x42, 0x82], Buffer.from("matroska")), // DocType
      element([0x42, 0x87], uint(4)), // DocTypeVersion
      element([0x42, 0x85], uint(2)), // DocTypeReadVersion
    ]),
  );
  const info = element(
    [0x15, 0x49, 0xa9, 0x66],
    Buffer.concat([
      element([0x2a, 0xd7, 0xb1], uint(1_000_000)), // TimestampScale: 1 ms
      element([0x4d, 0x80], Buffer.from("@effing/ffs")), // MuxingApp
      element([0x57, 0x41], Buffer.from("@effing/ffs")), // WritingApp
    ]),
  );
  const tracks: Buffer[] = [];
  for (let track = 1; track <= trackCount; track++) {
    tracks.push(
      element(
        [0xae], // TrackEntry
        Buffer.concat([
          element([0xd7], uint(track)), // TrackNumber
          element([0x73, 0xc5], uint(track)), // TrackUID
          element([0x83], uint(1)), // TrackType: video
          element([0x86], Buffer.from("V_MJPEG")), // CodecID
          element([0x23, 0xe3, 0x83], uint(Math.round(frameDurationNs))), // DefaultDuration
        ]),
      ),
    );
  }
  return Buffer.concat([
    ebml,
    Buffer.from([0x18, 0x53, 0x80, 0x67]), // Segment
    UNKNOWN_SIZE,
    info,
    element([0x16, 0x54, 0xae, 0x6b], Buffer.concat(tracks)), // Tracks
  ]);
}

/**
 * What goes before a frame of `frameSize` bytes on track `track` (1-based)
 * at `timestampMs`: a Cluster with that timestamp and a keyframe
 * SimpleBlock whose data is the frame.
 */
export function matroskaFrameHeader(
  track: number,
  timestampMs: number,
  frameSize: number,
): Buffer {
  const timestamp = element([0xe7], uint(timestampMs)); // Cluster Timestamp
  // Track number (1-byte EBML varint), relative timestamp 0, keyframe flag.
  const blockHead = Buffer.from([0x80 | track, 0, 0, 0x80]);
  const block = Buffer.concat([
    Buffer.from([0xa3]), // SimpleBlock
    size(blockHead.length + frameSize),
    blockHead,
  ]);
  return Buffer.concat([
    Buffer.from([0x1f, 0x43, 0xb6, 0x75]), // Cluster
    size(timestamp.length + block.length + frameSize),
    timestamp,
    block,
  ]);
}
