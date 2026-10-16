import AppKit
import CryptoKit
import CoreServices

// Read-only snapshot. Never clears or writes the user's pasteboard.
// Usage: swift tools/pasteboard-audit.swift OUTPUT_DIRECTORY
guard CommandLine.arguments.count == 2 else {
    fputs("Usage: swift tools/pasteboard-audit.swift OUTPUT_DIRECTORY\n", stderr)
    exit(2)
}
let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let fm = FileManager.default
guard !fm.fileExists(atPath: output.path) else {
    fputs("Refusing to overwrite an existing capture directory\n", stderr)
    exit(2)
}
try fm.createDirectory(at: output, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
let board = NSPasteboard.general
let before = board.changeCount
let advertised = (board.types ?? []).map(\.rawValue)
let items = board.pasteboardItems ?? []
var entries: [[String: Any]] = []
for (index, item) in items.enumerated() {
    // Preserve advertised order and item boundaries; do not assume one item.
    let types = item.types
    for (position, type) in types.enumerated() {
        var entry: [String: Any] = ["item": index, "position": position, "type": type.rawValue]
        if let tag = UTTypeCopyPreferredTagWithClass(type.rawValue as CFString, kUTTagClassNSPboardType)?.takeRetainedValue() {
            entry["registeredName"] = tag as String
        }
        let itemBytes = item.data(forType: type)
        // Qt/WPS advertises legacy names containing spaces. NSPasteboardItem
        // rejects these as UTIs; the board-level legacy API can still read them.
        let legacyBytes = itemBytes == nil && items.count == 1 ? board.data(forType: type) : nil
        entry["readAPI"] = itemBytes != nil ? "NSPasteboardItem" : "NSPasteboard (single item only)"
        if let bytes = itemBytes ?? legacyBytes {
            let filename = "item-\(index)-type-\(position).bin"
            try bytes.write(to: output.appendingPathComponent(filename), options: .atomic)
            try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.appendingPathComponent(filename).path)
            entry["file"] = filename
            entry["bytes"] = bytes.count
            entry["sha256"] = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
            print("[\(index):\(position)] \(type.rawValue) — \(bytes.count) bytes")
        } else {
            entry["readError"] = "Advertised type returned no data"
            print("[\(index):\(position)] \(type.rawValue) — NO DATA")
        }
        entries.append(entry)
    }
}
// Carbon exposes Qt legacy flavor names rejected by NSPasteboardItem.
var carbonEntries: [[String: Any]] = []
var carbonBoard: Pasteboard?
if PasteboardCreate(kPasteboardClipboard as CFString, &carbonBoard) == noErr, let cb = carbonBoard {
    var count = 0
    if PasteboardGetItemCount(cb, &count) == noErr, count > 0 {
        for index in 1...count {
            var identifier: PasteboardItemID?
            guard PasteboardGetItemIdentifier(cb, index, &identifier) == noErr, let identifier = identifier else { continue }
            var flavors: CFArray?
            guard PasteboardCopyItemFlavors(cb, identifier, &flavors) == noErr, let flavors = flavors else { continue }
            for (position, flavor) in (flavors as! [String]).enumerated() {
                var raw: CFData?
                let status = PasteboardCopyItemFlavorData(cb, identifier, flavor as CFString, &raw)
                var entry: [String: Any] = ["item": index - 1, "position": position, "type": flavor, "status": status]
                if let raw = raw, status == noErr {
                    let bytes = raw as Data
                    let filename = "carbon-item-\(index - 1)-type-\(position).bin"
                    try bytes.write(to: output.appendingPathComponent(filename), options: .atomic)
                    try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.appendingPathComponent(filename).path)
                    entry["file"] = filename
                    entry["bytes"] = bytes.count
                    entry["sha256"] = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
                    print("Carbon [\(index - 1):\(position)] \(flavor) — \(bytes.count) bytes")
                }
                carbonEntries.append(entry)
            }
        }
    }
}
let after = board.changeCount
let manifest: [String: Any] = ["capturedAt": ISO8601DateFormatter().string(from: Date()),
    "changeCountBefore": before, "changeCountAfter": after, "stable": before == after,
    "advertisedTypes": advertised, "itemCount": items.count, "representations": entries, "carbonRepresentations": carbonEntries]
try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
    .write(to: output.appendingPathComponent("manifest.json"), options: .atomic)
print("Snapshot: \(output.path)")
if before != after {
    fputs("Clipboard changed during capture; repeat this sample before drawing conclusions.\n", stderr)
    exit(1)
}
