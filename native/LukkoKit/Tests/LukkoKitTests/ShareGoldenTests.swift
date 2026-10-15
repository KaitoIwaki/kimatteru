import XCTest
@testable import LukkoKit

/// 描いた手順を記録するだけのキャンバス。字の幅は正解表を作ったときと同じ決まった式で測る
final class ShareRecCanvas: ShareCanvas {
    var ops: [JSONValue] = []
    var path: [JSONValue] = []
    var dash: [Double] = []
    var fillStyle = "#000000"
    var strokeStyle = "#000000"
    var lineWidth = 1.0
    var font = ShareFont(size: 10, weight: 400)
    var textAlign = "left"
    var textBaseline = "alphabetic"
    private func n(_ x: Double) -> JSONValue { .number(x) }
    private var fontKey: String { "\(font.weight) \(JS.numberToString(font.size))px" }
    func measureText(_ text: String) -> Double { Double(text.utf16.count) * font.size * 0.55 }
    func fillText(_ text: String, _ x: Double, _ y: Double) {
        ops.append(.array([.string("text"), .string(text), n(x), n(y), .string(fontKey), .string(fillStyle), .string(textAlign), .string(textBaseline)]))
    }
    func fillRect(_ x: Double, _ y: Double, _ w: Double, _ h: Double) { ops.append(.array([.string("rect"), n(x), n(y), n(w), n(h), .string(fillStyle)])) }
    func beginPath() { path = [] }
    func moveTo(_ x: Double, _ y: Double) { path.append(.array([.string("M"), n(x), n(y)])) }
    func arcTo(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ r: Double) { path.append(.array([.string("A"), n(x1), n(y1), n(x2), n(y2), n(r)])) }
    func arc(_ x: Double, _ y: Double, _ r: Double, _ a0: Double, _ a1: Double) { path.append(.array([.string("C"), n(x), n(y), n(r), n(a0), n(a1)])) }
    func closePath() { path.append(.array([.string("Z")])) }
    func fill() { ops.append(.array([.string("fill"), .array(path), .string(fillStyle)])) }
    func stroke() { ops.append(.array([.string("stroke"), .array(path), .string(strokeStyle), n(lineWidth), .array(dash.map { n($0) })])) }
    func setLineDash(_ d: [Double]) { dash = d }
}

/// 空いてる日をシェアと、まとめカード（月／年）が、Web 版と 1 つ残らず同じか（golden/share.json・share-cards.json）
final class ShareGoldenTests: XCTestCase {
    /// 数は小さな誤差（JSON を読むときの丸め）を許して比べる。"400 18.6px" のような字の大きさも数として比べる
    static func same(_ a: JSONValue?, _ b: JSONValue?) -> Bool {
        switch (a, b) {
        case (.number(let x)?, .number(let y)?): return abs(x - y) <= 1e-6 * max(1, abs(x), abs(y))
        case (.array(let x)?, .array(let y)?): return x.count == y.count && zip(x, y).allSatisfy { same($0, $1) }
        case (.string(let x)?, .string(let y)?):
            if x == y { return true }
            let px = x.split(separator: " "), py = y.split(separator: " ")
            if px.count == 2, py.count == 2, px[0] == py[0], px[1].hasSuffix("px"), py[1].hasSuffix("px"),
               let fx = Double(px[1].dropLast(2)), let fy = Double(py[1].dropLast(2)) { return abs(fx - fy) < 1e-9 }
            return false
        default: return a == b
        }
    }

    func cellsJSON(_ cs: [ShareView.Cell]) -> JSONValue {
        .array(cs.map { ["label": $0.label.map { .number(Double($0)) } ?? .string(""), "note": .string($0.note), "level": .string($0.level)] })
    }
    func chipsJSON(_ cs: [ShareView.Chip]) -> JSONValue { .array(cs.map { .array([.string($0.label), .bool($0.sel)]) }) }

    func testShare() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/share", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if !Self.same(got, want ?? .null) { fails += 1; if fails <= 30 { XCTFail("\(what())：\n\(String(describing: got))\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let v = eng.shareView()
            let o = c["out"] ?? .null
            check(.array(v.weekdays.map { .string($0) }), o["weekdays"], "#\(i) 曜日")
            check(.string(v.monthLabel), o["monthLabel"], "#\(i) 月")
            check(.string(v.lead), o["lead"], "#\(i) 先頭の札")
            check(.string(v.title), o["title"], "#\(i) 題")
            check(.array(v.legend.map { .string($0) }), o["legend"], "#\(i) 凡例")
            check(cellsJSON(v.cells), o["cells"], "#\(i) マス")
            check(chipsJSON(v.rangeChips), o["range"], "#\(i) 範囲の札")
            check(chipsJSON(v.onlyChips), o["only"], "#\(i) 平日休日の札")
            check(chipsJSON(v.toneChips), o["tone"], "#\(i) 言い回しの札")
            check(.string(v.name), o["name"], "#\(i) 名前")
            check(.string(v.text), o["text"], "#\(i) 送る文")
            check(.bool(v.sign), o["sign"], "#\(i) 署名")
            check(.bool(v.toast), .bool(JS.truthy(o["toast"])), "#\(i) 知らせ")
            check(.string(v.toastMsg), o["toastMsg"], "#\(i) 知らせの字")

            // 押す
            for op in c["ops"]?.array ?? [] {
                let a = op.array ?? []
                let k = JS.string(a.first), idx = a.count > 1 ? JS.int(a[1]) : 0
                let cur = eng.shareView()
                switch k {
                case "range": eng.setShareOpt("range", cur.rangeChips[idx].value)
                case "only": eng.setShareOpt("only", cur.onlyChips[idx].value)
                case "tone": eng.setShareOpt("polite", cur.toneChips[idx].value)
                case "sign": eng.toggleShareSign()
                default: eng.setShareName(a.count > 1 ? JS.string(a[1]) : "")
                }
            }
            check(eng.state["shareOpt"], c["afterOpt"], "#\(i) 押したあとの選び方 \(String(describing: c["ops"]))")
            check(.string(eng.shareView().text), c["afterText"], "#\(i) 押したあとの送る文")

            // 画像で送る
            let before0 = eng.state["settings"]?["lastReviewAsk"]
            let card = eng.freeCard()
            check(.string(card.fileName), c["file"], "#\(i) ファイル名")
            let sz = ShareCardDraw.size(card)
            check(.array([.number(Double(sz.w)), .number(Double(sz.h))]), .array([c["card"]?["w"] ?? .null, c["card"]?["h"] ?? .null]), "#\(i) 画像の大きさ")
            let rec = ShareRecCanvas()
            ShareCardDraw.drawFreeCard(card, rec)
            let want = c["card"]?["ops"]?.array ?? []
            if rec.ops.count != want.count { check(.number(Double(rec.ops.count)), .number(Double(want.count)), "#\(i) 描いた数") }
            for (j, (g, w)) in zip(rec.ops, want).enumerated() where !Self.same(g, w) { check(g, w, "#\(i) 空いてる日の画像 \(j)番目"); break }
            eng.shareCardDone(free: true)
            check(.bool(eng.state["settings"]?["lastReviewAsk"] != before0), c["askedCard"], "#\(i) 送ったあと評価の小窓")

            // 文字でコピー
            var s = eng.state["settings"]?.object ?? [:]
            if let before0 { s["lastReviewAsk"] = before0 } else { s.removeValue(forKey: "lastReviewAsk") }
            eng.set(["settings": .object(s)])
            var copied: String?
            eng.copyFreeText { t in copied = t; return "コピーしました。LINE やメールに貼り付けてください" }
            let cp = c["copy"] ?? .null
            check(copied.map { .string($0) } ?? .null, cp["text"], "#\(i) コピーした字")
            check(eng.state["shareMsg"], cp["msg"], "#\(i) コピーの知らせ")
            check(eng.state["shareToast"], cp["toast"], "#\(i) コピーの知らせを出す")
            check(.bool(eng.state["settings"]?["lastReviewAsk"] != before0), cp["asked"], "#\(i) コピーのあと評価の小窓")
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testSummaryCards() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/share-cards", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if !Self.same(got, want ?? .null) { fails += 1; if fails <= 30 { XCTFail("\(what())：\n\(String(describing: got))\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = ViewGoldenTests.engine(c)
            check(.string(eng.summaryCardTitle()), c["title"], "#\(i) 見出し")
            check(.string(eng.summaryCardFileName()), c["file"], "#\(i) ファイル名")
            let card = eng.summaryCard()
            let sz = ShareCardDraw.size(card)
            check(.array([.number(Double(sz.w)), .number(Double(sz.h))]), .array([c["card"]?["w"] ?? .null, c["card"]?["h"] ?? .null]), "#\(i) 画像の大きさ")
            let rec = ShareRecCanvas()
            ShareCardDraw.draw(card, rec)
            let want = c["card"]?["ops"]?.array ?? []
            if rec.ops.count != want.count { check(.number(Double(rec.ops.count)), .number(Double(want.count)), "#\(i) 描いた数") }
            for (j, (g, w)) in zip(rec.ops, want).enumerated() where !Self.same(g, w) { check(g, w, "#\(i) まとめカード \(j)番目"); break }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    /// 重ねて表示している予定は、その日にかかるものだけを数える（前の日・次の日の終日で × にしない）
    func testOverlayOnlyThatDay() {
        let tz = TimeZone(identifier: "Asia/Tokyo")!
        var st = Engine.defaultState(now: 1_790_000_000_000, tz: tz)
        var s = st["settings"]?.object ?? [:]
        s["overlayFree"] = true; s["overlayOn"] = true
        st["settings"] = .object(s)
        st["events"] = .array([])
        let core = AppCore(state: st)
        let ov: [[String: JSONValue]] = [["id": "p1", "y": 2026, "m": 9, "day": 10, "allDay": true, "start": "00:00", "end": "23:59", "status": "kakutei"]]
        XCTAssertEqual(core.dayFree(2026, 9, 10, overlay: ov).mark, "×")
        XCTAssertEqual(core.dayFree(2026, 9, 11, overlay: ov).mark, "○")
        XCTAssertEqual(core.dayFree(2026, 9, 9, overlay: ov).mark, "○")
    }
}
