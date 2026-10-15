import XCTest
@testable import LukkoKit

/// 応援・サポーターカード・規約の文・診断の行が、Web 版と同じか（golden/support.json）
final class SupportGoldenTests: XCTestCase {
    static func load() throws -> JSONValue {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/support", withExtension: "json"))
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }
    /// 小数はわずかな差（sin・exp の最後の桁）を許す
    static func close(_ a: Double, _ b: Double?) -> Bool {
        guard let b else { return false }
        if a == b { return true }
        return abs(a - b) <= 1e-9 * max(1, abs(a), abs(b))
    }

    func testFlip() throws {
        let g = try Self.load()
        var fails = 0
        func check(_ ok: Bool, _ what: @autoclosure () -> String) { if !ok { fails += 1; if fails <= 20 { XCTFail(what()) } } }
        for (i, c) in (g["flip"]?.array ?? []).enumerated() {
            let deg = c["deg"]?.number ?? 0, vel = c["vel"]?.number ?? 0
            check(Self.close(SupporterFlip.norm(deg), c["norm"]?.number), "#\(i) norm \(deg)")
            check(.bool(SupporterFlip.showsFront(deg)) == c["front"], "#\(i) front \(deg)")
            check(Self.close(SupporterFlip.dragToDeg(c["dx"]?.number ?? 0, c["w"]?.number ?? 0), c["drag"]?.number), "#\(i) drag")
            check(Self.close(SupporterFlip.tiltFor(c["dy"]?.number ?? 0), c["tilt"]?.number), "#\(i) tilt \(String(describing: c["dy"]))")
            let to = SupporterFlip.settle(deg, vel)
            check(Self.close(to, c["settle"]?.number), "#\(i) settle \(deg) \(vel) → \(to) ≠ \(String(describing: c["settle"]))")
            check(Self.close(SupporterFlip.settleTime(deg, to), c["settleTime"]?.number), "#\(i) settleTime")
            check(Self.close(SupporterFlip.settleTime(deg, c["other"]?.number ?? 0), c["settleTime2"]?.number), "#\(i) settleTime2")
            check(Self.close(SupporterFlip.ease(c["t"]?.number ?? 0), c["ease"]?.number), "#\(i) ease")
            let sh = SupporterFlip.shadow(deg).css, shb = SupporterFlip.shadow(deg, back: true).css
            check(.string(sh) == c["shadow"], "#\(i) shadow \(deg)：\n\(sh)\n≠\n\(String(describing: c["shadow"]))")
            check(.string(shb) == c["shadowBack"], "#\(i) shadowBack \(deg)：\n\(shb)\n≠\n\(String(describing: c["shadowBack"]))")
        }
    }

    func testTextureAndTiers() throws {
        let g = try Self.load()
        let tx = g["texture"] ?? .null
        func lines(_ got: [SupporterTexture.Line], _ want: JSONValue?, _ what: String) {
            let w = want?.array ?? []
            XCTAssertEqual(got.count, w.count, what)
            for (i, (l, x)) in zip(got, w).enumerated() {
                XCTAssertTrue(Self.close(l.x1, x["x1"]?.number) && Self.close(l.y1, x["y1"]?.number) && Self.close(l.x2, x["x2"]?.number) && Self.close(l.y2, x["y2"]?.number)
                              && Self.close(l.width, x["width"]?.number) && Self.close(l.op, x["op"]?.number) && .bool(l.light) == x["light"], "\(what) #\(i)")
            }
        }
        func dots(_ got: [SupporterTexture.Dot], _ want: JSONValue?, _ what: String) {
            let w = want?.array ?? []
            XCTAssertEqual(got.count, w.count, what)
            for (i, (d, x)) in zip(got, w).enumerated() {
                XCTAssertTrue(Self.close(d.x, x["x"]?.number) && Self.close(d.y, x["y"]?.number) && Self.close(d.s, x["s"]?.number) && .bool(d.light) == x["light"], "\(what) #\(i)")
            }
        }
        lines(SupporterTexture.brushLines(335, 211), tx["brush"], "刷り目")
        lines(SupporterTexture.brushLines(1080, (1080 / 1.586).rounded()), tx["brushBig"], "刷り目（書き出し）")
        dots(SupporterTexture.grainDots(335, 211), tx["grain"], "粒子")
        dots(SupporterTexture.tileDots(), tx["tile"], "粒の型")
        XCTAssertEqual(SupporterTexture.tileDots().count, tx["tileN"]?.int)
        let consts = tx["consts"]?.array ?? []
        XCTAssertEqual(consts.first?.number, Double(SupporterTexture.brushN))
        XCTAssertEqual(consts.count > 1 ? consts[1].number : nil, Double(SupporterTexture.grainN))
        func rgb(_ c: (Double, Double, Double)) -> String { "\(Int(c.0)),\(Int(c.1)),\(Int(c.2))" }
        XCTAssertEqual(consts.dropFirst(2).map { $0.string ?? "" }, [rgb(SupporterTexture.brushLight), rgb(SupporterTexture.brushDark), rgb(SupporterTexture.grainLight), rgb(SupporterTexture.grainDark)])

        // 段
        let tiers = g["tiers"]?.array ?? []
        XCTAssertEqual(tiers.count, SupporterTier.all.count)
        for (t, w) in zip(SupporterTier.all, tiers) {
            XCTAssertEqual(.string(t.key), w["key"]); XCTAssertEqual(.number(Double(t.min)), w["min"]); XCTAssertEqual(.string(t.name), w["name"])
            XCTAssertEqual(.array(t.paper.map { .string($0) }), w["paper"]); XCTAssertEqual(.string(t.foil), w["foil"]); XCTAssertEqual(.string(t.mark), w["mark"])
            XCTAssertEqual(.string(t.sheen), w["sheen"]); XCTAssertEqual(.string(t.edge), w["edge"]); XCTAssertEqual(t.fleck.map { .string($0) } ?? .null, w["fleck"] ?? .null)
            XCTAssertEqual(.string(t.glint.map { "\($0.color) \(JS.numberToString($0.at))%" }.joined(separator: ", ")), w["glint"], "glint \(t.key)")
            XCTAssertEqual(.string(t.paperStops.map { "\($0.color) \(JS.numberToString($0.at))%" }.joined(separator: ", ")), w["stops"], "stops \(t.key)")
        }
        for c in g["totals"]?.array ?? [] {
            let n = c["total"]?.int ?? 0
            XCTAssertEqual(.string(SupporterTier.tierFor(n).key), c["tier"], "tier \(n)")
            XCTAssertEqual(SupporterTier.nextTier(n).map { .string($0.key) } ?? .null, c["next"] ?? .null, "next \(n)")
        }
        let fl = g["flecks"]?.array ?? []
        XCTAssertEqual(fl.count, SupporterTier.flecks.count)
        for (f, w) in zip(SupporterTier.flecks, fl) {
            XCTAssertEqual(.array([.number(f.x), .number(f.y), .number(f.delay)]), w)
        }
    }

    func testLinksPricesDocs() throws {
        let g = try Self.load()
        for c in g["forms"]?.array ?? [] {
            let got = SupportCore.formHref(version: c["version"]?.string ?? "", kind: c["kind"]?.string ?? "", device: c["device"]?.string)
            XCTAssertEqual(.string(got), c["href"], "form \(String(describing: c["kind"])) \(String(describing: c["device"]))")
        }
        XCTAssertEqual(SupportCore.deviceLabel(model: "iPhone", systemVersion: "18.1.1"), "iPhone・iOS 18.1")
        XCTAssertEqual(SupportCore.deviceLabel(model: "iPhone", systemVersion: "18"), "iPhone・iOS 18.0")
        XCTAssertEqual(SupportCore.deviceLabel(model: "iPad", systemVersion: "17.0"), "iPad・iOS 17.0")
        XCTAssertNil(SupportCore.deviceLabel(model: "Mac", systemVersion: "15.0"))
        for c in g["prices"]?.array ?? [] {
            let got = SupportCore.priceText(raw: c["raw"]?.string ?? "", currencyCode: c["code"]?.string ?? "", yen: c["yen"]?.int ?? 0)
            XCTAssertEqual(.string(got), c["out"], "price \(String(describing: c["raw"])) \(String(describing: c["code"]))")
        }
        XCTAssertEqual(SupportCore.reviewHref, "https://apps.apple.com/app/id6794792375?action=write-review")
        // 規約の文（1 字ずつ）
        let d = g["docs"] ?? .null
        XCTAssertEqual(.string(DocsText.contact), d["contact"]); XCTAssertEqual(.string(DocsText.appName), d["appName"])
        XCTAssertEqual(.string(DocsText.appStoreId), d["appStoreId"]); XCTAssertEqual(.string(DocsText.effective), d["effective"])
        XCTAssertEqual(.string(DocsText.formURL), d["formURL"]); XCTAssertEqual(.string(SupportCore.formURL), d["formURL"])
        XCTAssertEqual(.array(DocsText.all.keys.sorted().map { .string($0) }), .array((d["keys"]?.array ?? []).sorted { ($0.string ?? "") < ($1.string ?? "") }))
        for (doc, w) in [(DocsText.privacy, d["privacy"]), (DocsText.terms, d["terms"])] {
            let got: JSONValue = ["key": .string(doc.key), "title": .string(doc.title), "lead": .string(doc.lead),
                                  "sections": .array(doc.sections.map { ["h": .string($0.h), "p": .array($0.p.map { .string($0) })] })]
            XCTAssertEqual(got, w, "doc \(doc.key)")
        }
    }

    func testViews() throws {
        let g = try Self.load()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["views"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let v = eng.supportView()
            let w = c["out"] ?? .null
            check(.bool(v.supporterShown), w["supporterShown"], "#\(i) supporterShown")
            if v.supporterShown {
                check(.string(v.supporterTotal), w["supporterTotal"], "#\(i) total")
                check(.string(v.supporterCount), w["supporterCount"], "#\(i) count")
                check(.string(v.supporterSince), w["supporterSince"], "#\(i) since")
            }
            check(.bool(v.tipShown), w["tipShown"], "#\(i) tipShown")
            check(.array(v.tipRows.map { ["id": .string($0.id), "label": .string($0.label), "price": .string($0.price), "pressed": .bool($0.busy)] }), w["tipRows"], "#\(i) tipRows")
            check(.bool(v.tipThanksShown), w["tipThanksShown"], "#\(i) thanks")
            if v.tipThanksShown {
                check(.string(v.tipThanksId), w["tipThanksId"], "#\(i) thanksId")
                check(.string(v.tipThanksPrice), w["tipThanksPrice"], "#\(i) thanksPrice")
            }
            if w["cardShown"] == .bool(true) {
                check(.string(v.cardOwner), w["cardOwner"], "#\(i) owner")
                check(.string(v.cardOwnerShown), w["cardOwnerShown"], "#\(i) ownerShown")
                check(.string(v.cardSince), w["cardSince"], "#\(i) since")
                check(.string(v.cardTotal), w["cardTotal"], "#\(i) cardTotal")
                check(.string(v.cardTimes), w["cardTimes"], "#\(i) times")
                check(.array(v.cardHistory.map { ["when": .string($0.when), "yen": .string($0.yen)] }), w["cardHistory"], "#\(i) history")
                check(.string(v.cardTierName), w["cardTierName"], "#\(i) tier")
                check(.string(v.cardMarkColor), w["cardMarkColor"], "#\(i) mark")
                check(.string(v.cardNextText), w["cardNextText"], "#\(i) next")
            }
            check(.bool(v.probeShown), w["probeShown"], "#\(i) probe")
            if v.probeShown {
                check(.array(v.probeRows.map { ["k": .string($0.k), "val": .string($0.val)] }), w["probeRows"], "#\(i) probeRows")
            }
        }
    }

    func testActions() throws {
        let g = try Self.load()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["acts"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let ops = c["ops"]?.array ?? [], steps = c["steps"]?.array ?? []
            for (k, o) in ops.enumerated() {
                eng.now = o["now"]?.number ?? eng.now
                if o["skip"] != .bool(true) {
                    let id = o["id"]?.string ?? ""
                    switch o["op"]?.string ?? "" {
                    case "buy": if eng.buyTipBegin(id) { eng.buyTipEnd(id, ok: true, msg: "") }
                    case "busyBuy":
                        eng.set(["tipBusy": .string(SupportCore.tips[0].id)])
                        XCTAssertFalse(eng.buyTipBegin(id))
                        eng.set(["tipBusy": .null])
                    case "close": eng.closeTipThanks()
                    case "thanksCard": eng.tipThanksCard()
                    case "openCard": eng.openCard()
                    case "cardBack": eng.cardBack()
                    case "name": eng.setSupporterName(o["s"]?.string ?? "")
                    default: break
                    }
                }
                let st = eng.state
                let got: JSONValue = ["supports": st["supports"] ?? .null, "tipThanks": st["tipThanks"] ?? .null, "tipBusy": st["tipBusy"] ?? .null,
                                      "screen": st["screen"] ?? .null, "cardAngle": st["cardAngle"] ?? .null, "supporterName": st["settings"]?["supporterName"] ?? .null]
                let want = steps.indices.contains(k) ? steps[k] : .null
                var w: [String: JSONValue] = [:]
                for key in ["supports", "tipThanks", "tipBusy", "screen", "cardAngle", "supporterName"] { w[key] = want[key] ?? .null }
                check(got, .object(w), "#\(i) step \(k) \(o["op"]?.string ?? "")")
            }
        }
    }
}
