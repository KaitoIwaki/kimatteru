import XCTest
@testable import LukkoKit

/// 設定の「控えと機種変更」「ファイルで出し入れ」「最近消した予定」と、設定の画面の残りの値・操作が、Web 版と同じか（golden/backup-view.json）
final class BackupViewGoldenTests: XCTestCase {
    static func fixture() throws -> JSONValue {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/backup-view", withExtension: "json"))
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }

    func testBackupActions() throws {
        let g = try Self.fixture()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? JSONValue.null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["acts"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let ops = c["ops"]?.array ?? [], steps = c["steps"]?.array ?? []
            for (k, o) in ops.enumerated() {
                if o["skip"] == JSONValue.bool(true) { continue }
                switch o["op"]?.string ?? "" {
                case "open": eng.openBackupList(o["list"]?.array ?? [])
                case "pickLocal": eng.pickLocalBackup(o["text"]?.string)
                case "file": eng.readBackupFile(o["text"]?.string, size: o["size"]?.int ?? 0)
                case "noInput": eng.pickBackupUnavailable()
                case "paste": eng.togglePaste()
                case "text": eng.setBackupText(o["s"]?.string ?? "")
                case "ask": eng.askRestore()
                case "export": eng.now = o["now"]?.number ?? eng.now; eng.markBackupExported()
                case "close": eng.closeBackupList()
                default: break
                }
                let st = eng.state
                let v = eng.settingsView()
                let cr = st["confirmRestore"]
                var crOut: JSONValue = JSONValue.null
                if let cr, cr != JSONValue.null {
                    var o: [String: JSONValue] = ["count": cr["count"] ?? JSONValue.null, "dropped": cr["dropped"] ?? JSONValue.null,
                                                  "n": JSONValue.number(Double(cr["data"]?["events"]?.array?.count ?? 0))]
                    if let at = cr["at"] { o["at"] = at }
                    crOut = JSONValue.object(o)
                }
                var gotO: [String: JSONValue] = [:]
                for key in ["backupError", "backupListOpen", "pasteOpen", "backupText"] { gotO[key] = st[key] ?? JSONValue.null }
                gotO["confirmRestore"] = crOut
                gotO["lastExportAt"] = st["settings"]?["lastExportAt"] ?? JSONValue.null
                var rows: [JSONValue] = []
                if v.backupListShown {
                    for r in v.backupRows { rows.append(JSONValue.object(["key": JSONValue.string(r.key), "label": JSONValue.string(r.label)])) }
                }
                gotO["backupRows"] = JSONValue.array(rows)
                gotO["restoreDisabled"] = JSONValue.bool(v.restoreDisabled)
                let got = JSONValue.object(gotO)
                let want = steps.indices.contains(k) ? steps[k] : JSONValue.null
                var w: [String: JSONValue] = [:]
                for key in ["backupError", "backupListOpen", "pasteOpen", "backupText", "confirmRestore", "lastExportAt", "backupRows", "restoreDisabled"] { w[key] = want[key] ?? JSONValue.null }
                check(got, JSONValue.object(w), "#\(i) step \(k) \(o["op"]?.string ?? "")")
            }
        }
    }

    func testSettingsMore() throws {
        let g = try Self.fixture()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? JSONValue.null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["views"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let v = eng.settingsView()
            let w = c["out"] ?? JSONValue.null
            check(JSONValue.array(v.weekSeg.map { ["label": JSONValue.string($0.label), "sel": JSONValue.bool($0.sel)] }), w["weekSeg"], "#\(i) weekSeg")
            check(JSONValue.bool(v.remindRowShown), w["remindRowShown"], "#\(i) remindRowShown")
            check(JSONValue.bool(v.overlayFree), w["overlayFree"], "#\(i) overlayFree")
            check(JSONValue.bool(v.overlayCalsShown), w["overlayCalsShown"], "#\(i) overlayCals")
            check(JSONValue.bool(v.syncShown), w["syncShown"], "#\(i) syncShown")
            check(JSONValue.bool(v.newTypeShown), w["newTypeShown"], "#\(i) newTypeShown")
            check(JSONValue.string(v.newTypeName), w["newTypeName"], "#\(i) newTypeName")
            check(JSONValue.string(v.newTypeEg), w["newTypeEg"], "#\(i) newTypeEg")
            check(JSONValue.bool(v.tplNewShown), w["tplNewShown"], "#\(i) tplNewShown")
            check(JSONValue.string(v.tplSym), w["tplSym"], "#\(i) tplSym")
            check(JSONValue.string(v.tplName), w["tplName"], "#\(i) tplName")
            check(JSONValue.bool(v.tplAllDay), w["tplAllDay"], "#\(i) tplAllDay")
            check(JSONValue.number(Double(v.tidyCount)), w["tidyCount"], "#\(i) tidyCount")
            check(JSONValue.bool(v.pasteOpen), w["pasteOpen"], "#\(i) pasteOpen")
            check(JSONValue.string(v.backupText), w["backupText"], "#\(i) backupText")
            check(JSONValue.string(v.backupError), w["backupError"], "#\(i) backupError")
            check(JSONValue.bool(v.restoreDisabled), w["restoreDisabled"], "#\(i) restoreDisabled")
            check(JSONValue.bool(v.trashShown), w["trashShown"], "#\(i) trashShown")
            check(JSONValue.string(eng.backupFileName()), w["stamp"], "#\(i) 控えのファイル名")
            check(JSONValue.string(eng.icsText()), w["ics"], "#\(i) .ics")
        }
    }

    func testSettingsActions() throws {
        let g = try Self.fixture()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? JSONValue.null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        let keys = ["newType", "editTypeKey", "editJobId", "jobs", "tplNew", "screen", "docKey", "trashOpen", "trash", "events"]
        for (i, c) in (g["setActs"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let ops = c["ops"]?.array ?? [], steps = c["steps"]?.array ?? []
            for (k, o) in ops.enumerated() {
                if o["skip"] != JSONValue.bool(true) {
                    switch o["op"]?.string ?? "" {
                    case "addTypeRow": eng.addTypeRow()
                    case "minus": eng.set(["editJobId": "j0"]); eng.stepJobHourly("j0", -10)
                    case "plus": eng.set(["editJobId": "j0"]); eng.stepJobHourly("j0", 10)
                    case "tplOpen": eng.set(["editJobId": "j0"]); eng.openTemplateNew("j0")
                    case "tplSym": eng.setTemplateSym(o["s"]?.string ?? "")
                    case "tplName": eng.setTemplateName(o["s"]?.string ?? "")
                    case "tplSave": eng.saveTemplateNew()
                    case "tplClose": eng.closeTemplateNew()
                    case "terms": eng.openDoc("terms")
                    case "privacy": eng.openDoc("privacy")
                    case "docBack": eng.docBack()
                    case "trashOpen": eng.openTrash()
                    case "trashClose": eng.closeTrash()
                    case "restore": eng.set(["trashOpen": true]); eng.restoreTrashRow(o["key"] ?? JSONValue.null)
                    default: break
                    }
                }
                let st = eng.state
                var got: [String: JSONValue] = [:]
                for key in keys { got[key] = st[key] ?? JSONValue.null }
                got["jobs"] = JSONValue.array((st["jobs"]?.array ?? []).map { j in
                    ["id": j["id"] ?? JSONValue.null, "hourly": j["hourly"] ?? JSONValue.null, "templates": JSONValue.array((j["templates"]?.array ?? []).map { t in
                        var o: [String: JSONValue] = [:]
                        for kk in ["sym", "name", "from", "to", "brk", "allDay"] { if let x = t[kk] { o[kk] = x } }
                        return JSONValue.object(o)
                    })]
                })
                got["trash"] = JSONValue.array((st["trash"]?.array ?? []).map { $0["ev"]?["id"] ?? JSONValue.null })
                got["events"] = JSONValue.array((st["events"]?.array ?? []).map { $0["id"] ?? JSONValue.null })
                let want = steps.indices.contains(k) ? steps[k] : JSONValue.null
                var w: [String: JSONValue] = [:]
                for key in keys { w[key] = want[key] ?? JSONValue.null }
                check(JSONValue.object(got), JSONValue.object(w), "#\(i) step \(k) \(o["op"]?.string ?? "")")
            }
        }
    }
}
