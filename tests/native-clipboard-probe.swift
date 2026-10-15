import AppKit
let p = NSPasteboard.general
let args = CommandLine.arguments
switch args[1] {
case "backup":
 let items = (p.pasteboardItems ?? []).map { item in Dictionary(uniqueKeysWithValues: item.types.compactMap { t in item.data(forType:t).map { (t.rawValue,$0) } }) }
 try PropertyListEncoder().encode(items).write(to:URL(fileURLWithPath:args[2]),options:.atomic)
case "restore":
 let items = try PropertyListDecoder().decode([[String:Data]].self,from:Data(contentsOf:URL(fileURLWithPath:args[2])))
 p.clearContents(); p.writeObjects(items.map { values in let i = NSPasteboardItem(); for (t,d) in values { i.setData(d,forType:NSPasteboard.PasteboardType(t)) }; return i })
case "sentinel": p.clearContents(); p.setString("FORMULA_A02_SENTINEL",forType:.string)
case "expect":
 let ok = p.string(forType:.string) == args[2]; print(ok ? "PASS native clipboard text matches expected fixture" : "FAIL native clipboard text mismatch"); if !ok { exit(1) }
case "graphic":
 let types = (p.types ?? []).map(\.rawValue); let ok = types.contains { $0.contains("png") || $0.contains("svg") || $0.contains("pdf") || $0.contains("tiff") }; print(ok ? "PASS native clipboard graphic representation" : "FAIL graphic representation absent"); print(types); if !ok { exit(1) }
default: exit(2)
}
