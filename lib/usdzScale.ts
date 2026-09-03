import "server-only";
import { crc32 } from "node:zlib";

interface ZipEntry {
  name: string;
  data: Buffer;
}

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
// Apple's own USDZ packaging tools use this extra-field ID for pure
// alignment padding (confirmed directly in a real Tripo-generated USDZ —
// every entry's data start is padded to a 64-byte boundary with an extra
// field whose 2-byte ID is exactly this, followed by a 2-byte length and
// that many zero bytes). RealityKit/Quick Look mmaps texture data straight
// out of the zip, which is why USDZ requires this — an unaligned load
// would still probably work but the spec mandates it and every real-world
// file has it, so this mirrors that rather than risk being the one
// consumer that skips it.
const ALIGNMENT_EXTRA_ID = 0x1986;
const ALIGNMENT_BYTES = 64;

/**
 * Reads a USDZ (a plain zip, required by spec to be entirely
 * uncompressed/STORE — confirmed on a real Tripo file, every entry had
 * method 0) into its raw entries. Deliberately doesn't use a general-
 * purpose zip library: USDZ's only-ever-STORE constraint makes hand-
 * rolling a reader simpler and more auditable than pulling in a dependency
 * that also has to support (and correctly reject) DEFLATE, encryption, and
 * every other zip feature this format never uses.
 */
function readZipEntries(buf: Buffer): ZipEntry[] {
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Not a valid zip: end-of-central-directory record not found");

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== CENTRAL_DIR_SIG) throw new Error(`Malformed central directory entry at offset ${p}`);
    const method = buf.readUInt16LE(p + 10);
    const expectedCrc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (method !== 0) throw new Error(`USDZ entry "${name}" is compressed (method ${method}) — USDZ must be store-only`);

    if (buf.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIG) {
      throw new Error(`Malformed local file header for "${name}"`);
    }
    // The local header's own extra-field length can differ from the copy
    // recorded in the central directory (a real, if easy to miss, zip
    // quirk) — read it directly rather than trusting the central dir's.
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);

    if (crc32(data) !== expectedCrc) {
      throw new Error(`CRC mismatch for "${name}" — source USDZ may be corrupt`);
    }

    entries.push({ name, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Zero-padded extra field that pads this entry's data start to the next 64-byte boundary. */
function alignmentExtraField(precedingBytes: number): Buffer {
  const base = precedingBytes + 4; // +4 for this extra field's own id+length prefix
  const rem = base % ALIGNMENT_BYTES;
  const padLen = rem === 0 ? 0 : ALIGNMENT_BYTES - rem;
  const extra = Buffer.alloc(4 + padLen);
  extra.writeUInt16LE(ALIGNMENT_EXTRA_ID, 0);
  extra.writeUInt16LE(padLen, 2);
  return extra;
}

/** Writes a store-only, 64-byte-aligned zip — the exact shape USDZ requires. */
function writeZip(entries: ZipEntry[]): Buffer {
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  const localChunks: Buffer[] = [];
  const centralRecords: { name: Buffer; crc: number; size: number; localHeaderOffset: number }[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const extra = alignmentExtraField(offset + 30 + nameBuf.length);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // method: store
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(extra.length, 28);

    const localHeaderOffset = offset;
    localChunks.push(localHeader, nameBuf, extra, data);

    const dataStart = offset + 30 + nameBuf.length + extra.length;
    if (dataStart % ALIGNMENT_BYTES !== 0) {
      // Can only happen from a bug in alignmentExtraField's own math.
      throw new Error(`Internal error: "${name}" data would start unaligned at ${dataStart}`);
    }
    offset = dataStart + data.length;

    centralRecords.push({ name: nameBuf, crc, size: data.length, localHeaderOffset });
  }

  const centralChunks: Buffer[] = [];
  const centralDirStart = offset;
  for (const r of centralRecords) {
    const rec = Buffer.alloc(46);
    rec.writeUInt32LE(CENTRAL_DIR_SIG, 0);
    rec.writeUInt16LE(20, 4); // version made by
    rec.writeUInt16LE(20, 6); // version needed
    rec.writeUInt16LE(0, 8); // flags
    rec.writeUInt16LE(0, 10); // method
    rec.writeUInt16LE(dosTime, 12);
    rec.writeUInt16LE(dosDate, 14);
    rec.writeUInt32LE(r.crc, 16);
    rec.writeUInt32LE(r.size, 20);
    rec.writeUInt32LE(r.size, 24);
    rec.writeUInt16LE(r.name.length, 28);
    rec.writeUInt16LE(0, 30); // extra len — none needed in the central directory copy
    rec.writeUInt16LE(0, 32); // comment len
    rec.writeUInt16LE(0, 34); // disk number
    rec.writeUInt16LE(0, 36); // internal attrs
    rec.writeUInt32LE(0, 38); // external attrs
    rec.writeUInt32LE(r.localHeaderOffset, 42);
    centralChunks.push(rec, r.name);
  }
  const centralDirBuf = Buffer.concat(centralChunks);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(centralDirStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirBuf, eocd]);
}

/**
 * Bakes a uniform scale factor into a USDZ by wrapping its existing root
 * layer in a new one, rather than editing the mesh data at all.
 *
 * Why a wrapper, not an edit: USDZ's actual geometry lives in a binary USD
 * "crate" (.usdc) file — a proprietary Pixar format with no general-purpose
 * JS parser (lib/glbScale.ts's own header used to say exactly this was an
 * unsolved gap). But USD's composition system supports adding a NEW root
 * layer that `references` the original file by name and carries its own
 * transform — a completely standard, spec-legal USD pattern — which means
 * the original .usdc's bytes never need to be touched or understood at
 * all. The new root becomes: a plain-text USDA file (trivial to construct
 * directly) that references the original by filename and applies
 * `xformOp:scale`; USD resolves the reference against its own
 * `defaultPrim`, so nothing about the original content needs to be known
 * beyond its filename (the first entry, by USDZ convention, which is what
 * Quick Look already treats as the entry point today).
 *
 * Verified directly with Apple's own USD command-line tools (ship with
 * macOS at /usr/bin/usdchecker, /usr/bin/usdcat — the same USD engine
 * RealityKit/Quick Look is built on, not a reimplementation): `usdchecker`
 * reports the wrapped file fully compliant, and `usdcat --flatten` shows
 * the composed stage with the scale correctly applied on top of the
 * original mesh's own untouched extent — this is the strongest check
 * available without a physical iOS device, which this environment doesn't
 * have; a real AR Quick Look check on-device is still the actual proof.
 *
 * The zip-level mechanics (store-only, 64-byte alignment) are handled by
 * readZipEntries/writeZip above — this function only handles the USD side.
 */
export async function bakeUsdzScale(input: Buffer, factor: number): Promise<Buffer> {
  const entries = readZipEntries(input);
  if (entries.length === 0) throw new Error("USDZ has no entries");

  // USDZ convention (and what Quick Look actually opens): the first entry
  // in the archive is the default/root layer.
  const rootLayerName = entries[0].name;

  const usda = `#usda 1.0
(
    defaultPrim = "Root"
    upAxis = "Y"
    metersPerUnit = 1
)

def Xform "Root" (
    prepend references = @${rootLayerName}@
)
{
    double3 xformOp:scale = (${factor}, ${factor}, ${factor})
    uniform token[] xformOpOrder = ["xformOp:scale"]
}
`;

  const wrapperEntry: ZipEntry = { name: "root.usda", data: Buffer.from(usda, "utf8") };
  return writeZip([wrapperEntry, ...entries]);
}
