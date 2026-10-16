import AppKit
import CoreServices

// Deliberately replaces the clipboard with captured flavors for protocol tests.
// Usage: swift tools/pasteboard-replay.swift CAPTURE_DIR TYPE [TYPE ...]
guard CommandLine.arguments.count >= 3 else { exit(2) }
let folder = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: folder.appendingPathComponent("manifest.json"))) as! [String: Any]
guard manifest["stable"] as? Bool == true,
      let entries = manifest["carbonRepresentations"] as? [[String: Any]] else { exit(2) }
let requested = Array(CommandLine.arguments.dropFirst(2))
// Validate and load everything before changing the clipboard.
let values: [(String, Data)] = try requested.map { type in
    guard let entry = entries.first(where: { $0["type"] as? String == type && $0["item"] as? Int == 0 }),
          let file = entry["file"] as? String, URL(fileURLWithPath: file).lastPathComponent == file else {
        throw NSError(domain: "PasteboardReplay", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing captured type: \(type)"])
    }
    return (type, try Data(contentsOf: folder.appendingPathComponent(file)))
}
var board: Pasteboard?
guard PasteboardCreate(kPasteboardClipboard as CFString, &board) == noErr, let board = board else { exit(1) }
guard PasteboardClear(board) == noErr else { exit(1) }
let item = UnsafeMutableRawPointer(bitPattern: 1)!
for (type, bytes) in values {
    let status = PasteboardPutItemFlavor(board, item, type as CFString, bytes as CFData, PasteboardFlavorFlags(rawValue: 0))
    guard status == noErr else { fputs("Write failed: \(status)\n", stderr); exit(1) }
    var result: CFData?
    guard PasteboardCopyItemFlavorData(board, item, type as CFString, &result) == noErr,
          let result = result, result as Data == bytes else { exit(1) }
    print("Replayed and verified: \(type) — \(bytes.count) bytes")
}
