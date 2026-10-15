import Foundation
import LukkoKit

/// iPhone のカレンダーとのつなぎ（Web 版の toggleExportCal・_syncExport・toggleOverlay・_loadOverlay の写し）
extension AppModel {
    var phone: PhoneCalendar? { engine.phone }

    // MARK: 書き出しの対応表（いまの版の localStorage の lukko.exportMap を、引っ越しでファイルにしたもの）
    func loadExportMap() -> [String: JSONValue] {
        guard let d = try? Data(contentsOf: data.exportMapURL), let v = try? JSJSON.parse(String(decoding: d, as: UTF8.self)), case .object(let o) = v else { return [:] }
        return o
    }
    func saveExportMap(_ m: [String: JSONValue]) {
        try? SafeFile.write(Data(JSJSON.stringify(.object(m)).utf8), to: data.exportMapURL)
    }

    /// 決まった予定を「LUKKO」カレンダーにそろえる
    func syncExport() async {
        let cfg = state["settings"] ?? .null
        guard JS.truthy(cfg["exportCal"]), !exporting else { return }
        exporting = true
        defer { exporting = false }
        guard let id = await PhoneCal.ensureExportCalendar(phone, knownId: cfg["exportCalId"]) else { return }
        if JSONValue.string(id) != cfg["exportCalId"] { engine.setSetting("exportCalId", .string(id)) }
        let out = await PhoneCal.syncExport(phone, events: state["events"]?.array ?? [], calId: id, map: loadExportMap(),
                                            hideAll: JS.truthy(cfg["hideTitles"]), tz: .current)
        saveExportMap(out.object)
    }

    func toggleExportCal() {
        engine.haptic("light")
        let cfg = state["settings"] ?? .null
        Task { @MainActor in
            if JS.truthy(cfg["exportCal"]) {
                let map = loadExportMap()
                engine.setSetting("exportCal", false)
                await PhoneCal.clearExport(phone, map: map)
                saveExportMap([:])
                engine.toast("iPhone のカレンダーに書いた予定を消しました")
                return
            }
            let perm = await PhoneCal.askAccess(phone)
            if perm != "granted" { engine.toast(perm == "unavailable" ? "この端末では使えません" : "カレンダーの許可が必要です（設定アプリで許可できます）", 3200); return }
            guard let id = await PhoneCal.ensureExportCalendar(phone, knownId: cfg["exportCalId"]) else { engine.toast("「LUKKO」カレンダーを作れませんでした", 3200); return }
            engine.set(["settings": .object(Engine.with(state["settings"]?.object ?? [:], ["exportCal": true, "exportCalId": .string(id)]))])
            Task { await syncExport() }
            engine.toast("決まった予定を、iPhone のカレンダーの「LUKKO」に入れます")
        }
    }

    // MARK: 重ねて表示（会社や家族のカレンダーを灰色の帯で。LUKKO には保存しない）
    func toggleOverlay() {
        engine.haptic("light")
        let on = !JS.truthy(state["settings"]?["overlayOn"])
        Task { @MainActor in
            if !on { overlay = []; engine.setSetting("overlayOn", false); return }
            let perm = await PhoneCal.askAccess(phone)
            if perm != "granted" { engine.toast(perm == "unavailable" ? "この端末では使えません" : "カレンダーを読む許可が必要です（設定アプリで許可できます）", 3200); return }
            let cals = await PhoneCal.listPhoneCalendars(phone)
            let st = state["settings"]?.object ?? [:]
            let ids: JSONValue = ((st["overlayIds"]?.array ?? []).isEmpty) ? .array(cals.filter { !JS.truthy($0["sub"]) }.map { $0["id"] ?? .null }) : (st["overlayIds"] ?? .array([]))
            engine.set(["overlayCals": .array(cals), "settings": .object(Engine.with(st, ["overlayOn": true, "overlayIds": ids]))])
            await loadOverlay()
        }
    }
    func toggleOverlayCal(_ id: JSONValue) {
        engine.haptic("light")
        let cur = state["settings"]?["overlayIds"]?.array ?? []
        engine.setSetting("overlayIds", .array(cur.contains(id) ? cur.filter { $0 != id } : cur + [id]))
        Task { await loadOverlay() }
    }
    /// 見えている前後の月（今日の 2 か月前〜14 か月先）の、重ねて表示する予定を読む
    func loadOverlay() async {
        let cfg = state["settings"] ?? .null
        guard JS.truthy(cfg["overlayOn"]), !(cfg["overlayIds"]?.array ?? []).isEmpty, phone != nil else { if !overlay.isEmpty { overlay = [] }; return }
        if state["overlayCals"] == nil { engine.set(["overlayCals": .array(await PhoneCal.listPhoneCalendars(phone))]) }
        let t = state["today"] ?? .null
        let y = JS.int(t["y"]), m = JS.int(t["m"])
        let from = JSDate.make(y, m - 2, 1, 0, 0, 0, .current), to = JSDate.make(y, m + 14, 0, 23, 59, 0, .current)
        overlay = await PhoneCal.readOverlay(phone, ids: cfg["overlayIds"]?.array, from: from, to: to, tz: .current).compactMap { $0.object }
    }
    /// 日番号 a〜b（b は含まない）にかかる、重ねて表示する予定
    func overlayFor(_ a: Int, _ b: Int) -> [[String: JSONValue]] {
        guard JS.truthy(state["settings"]?["overlayOn"]) else { return [] }
        return overlay.filter { e in
            let f = AppCore.evFrom(e), l = AppCore.evTo(e) + (WhenLib.endsNextDay(e) ? 1 : 0)
            return l >= a && f < b
        }
    }
}
