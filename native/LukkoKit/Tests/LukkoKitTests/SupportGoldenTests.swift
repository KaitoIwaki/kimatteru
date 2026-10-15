import XCTest
@testable import LukkoKit

/// 応援・サポーターカード・規約の文・診断の行が、Web 版と同じか（golden/support.json）
final class SupportGoldenTests: XCTestCase {
    static func fixture() throws -> JSONValue {
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
        let g = try Self.fixture()
        var fails = 0
        func check(_ ok: Bool, _ what: @autoclosure () -> String) { if !ok { fails += 1; if fails <= 20 { XCTFail(what()) } } }
        for (i, c) in (g["flip"]?.array ?? []).enumerated() {
            let deg = c["deg"]?.number ?? 0, vel = c["vel"]?.number ?? 0
            check(Self.close(SupporterFlip.norm(deg), c["norm"]?.number), "#\(i) norm \(deg)")
            check(JSONValue.bool(SupporterFlip.showsFront(deg)) == c["front"], "#\(i) front \(deg)")
            check(Self.close(SupporterFlip.dragToDeg(c["dx"]?.number ?? 0, c["w"]?.number ?? 0), c["drag"]?.number), "#\(i) drag")
            check(Self.close(SupporterFlip.tiltFor(c["dy"]?.number ?? 0), c["tilt"]?.number), "#\(i) tilt \(String(describing: c["dy"]))")
            let to = SupporterFlip.settle(deg, vel)
            check(Self.close(to, c["settle"]?.number), "#\(i) settle \(deg) \(vel) → \(to) ≠ \(String(describing: c["settle"]))")
            check(Self.close(SupporterFlip.settleTime(deg, to), c["settleTime"]?.number), "#\(i) settleTime")
            check(Self.close(SupporterFlip.settleTime(deg, c["other"]?.number ?? 0), c["settleTime2"]?.number), "#\(i) settleTime2")
            check(Self.close(SupporterFlip.ease(c["t"]?.number ?? 0), c["ease"]?.number), "#\(i) ease")
            let sh = SupporterFlip.shadow(deg).css, shb = SupporterFlip.shadow(deg, back: true).css
            check(JSONValue.string(sh) == c["shadow"], "#\(i) shadow \(deg)：\n\(sh)\n≠\n\(String(describing: c["shadow"]))")
            check(JSONValue.string(shb) == c["shadowBack"], "#\(i) shadowBack \(deg)：\n\(shb)\n≠\n\(String(describing: c["shadowBack"]))")
        }
    }

    func testTextureAndTiers() throws {
        let g = try Self.fixture()
        let tx = g["texture"] ?? JSONValue.null
        func lines(_ got: [SupporterTexture.Line], _ want: JSONValue?, _ what: String) {
            let w = want?.array ?? []
            XCTAssertEqual(got.count, w.count, what)
            for (i, (l, x)) in zip(got, w).enumerated() {
                XCTAssertTrue(Self.close(l.x1, x["x1"]?.number) && Self.close(l.y1, x["y1"]?.number) && Self.close(l.x2, x["x2"]?.number) && Self.close(l.y2, x["y2"]?.number)
                              && Self.close(l.width, x["width"]?.number) && Self.close(l.op, x["op"]?.number) && JSONValue.bool(l.light) == x["light"], "\(what) #\(i)")
            }
        }
        // 粒の位置は sin の最後の桁しだいで、小数の部分が 0.9999… と 0.0000… に分かれることがある（端から端へ回り込む）。
        // V8 と Apple の sin は最後の 1 桁が違うことがあるので、その回り込みだけは同じと見る（絵としては同じ点）
        func near(_ a: Double, _ b: Double?, _ span: Double) -> Bool {
            guard let b else { return false }
            return Self.close(a, b) || abs(abs(a - b) - span) <= 1e-6 * span
        }
        func dots(_ got: [SupporterTexture.Dot], _ want: JSONValue?, _ what: String, _ w0: Double, _ h0: Double) {
            let w = want?.array ?? []
            XCTAssertEqual(got.count, w.count, what)
            for (i, (d, x)) in zip(got, w).enumerated() {
                XCTAssertTrue(near(d.x, x["x"]?.number, w0) && near(d.y, x["y"]?.number, h0) && Self.close(d.s, x["s"]?.number) && JSONValue.bool(d.light) == x["light"],
                              "\(what) #\(i) \(d) ≠ \(x)")
            }
        }
        lines(SupporterTexture.brushLines(335, 211), tx["brush"], "刷り目")
        lines(SupporterTexture.brushLines(1080, (1080 / 1.586).rounded()), tx["brushBig"], "刷り目（書き出し）")
        dots(SupporterTexture.grainDots(335, 211), tx["grain"], "粒子", 335, 211)
        dots(SupporterTexture.tileDots(), tx["tile"], "粒の型", 64, 64)
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
            XCTAssertEqual(JSONValue.string(t.key), w["key"]); XCTAssertEqual(JSONValue.number(Double(t.min)), w["min"]); XCTAssertEqual(JSONValue.string(t.name), w["name"])
            XCTAssertEqual(JSONValue.array(t.paper.map { JSONValue.string($0) }), w["paper"]); XCTAssertEqual(JSONValue.string(t.foil), w["foil"]); XCTAssertEqual(JSONValue.string(t.mark), w["mark"])
            XCTAssertEqual(JSONValue.string(t.sheen), w["sheen"]); XCTAssertEqual(JSONValue.string(t.edge), w["edge"]); XCTAssertEqual(t.fleck.map { JSONValue.string($0) } ?? JSONValue.null, w["fleck"] ?? JSONValue.null)
            XCTAssertEqual(JSONValue.string(t.glint.map { "\($0.color) \(JS.numberToString($0.at))%" }.joined(separator: ", ")), w["glint"], "glint \(t.key)")
            XCTAssertEqual(JSONValue.string(t.paperStops.map { "\($0.color) \(JS.numberToString($0.at))%" }.joined(separator: ", ")), w["stops"], "stops \(t.key)")
        }
        for c in g["totals"]?.array ?? [] {
            let n = c["total"]?.int ?? 0
            XCTAssertEqual(JSONValue.string(SupporterTier.tierFor(n).key), c["tier"], "tier \(n)")
            XCTAssertEqual(SupporterTier.nextTier(n).map { JSONValue.string($0.key) } ?? JSONValue.null, c["next"] ?? JSONValue.null, "next \(n)")
        }
        let fl = g["flecks"]?.array ?? []
        XCTAssertEqual(fl.count, SupporterTier.flecks.count)
        for (f, w) in zip(SupporterTier.flecks, fl) {
            XCTAssertEqual(JSONValue.array([JSONValue.number(f.x), JSONValue.number(f.y), JSONValue.number(f.delay)]), w)
        }
    }

    func testLinksPricesDocs() throws {
        let g = try Self.fixture()
        for c in g["forms"]?.array ?? [] {
            let got = SupportCore.formHref(version: c["version"]?.string ?? "", kind: c["kind"]?.string ?? "", device: c["device"]?.string)
            XCTAssertEqual(JSONValue.string(got), c["href"], "form \(String(describing: c["kind"])) \(String(describing: c["device"]))")
        }
        XCTAssertEqual(SupportCore.deviceLabel(model: "iPhone", systemVersion: "18.1.1"), "iPhone・iOS 18.1")
        XCTAssertEqual(SupportCore.deviceLabel(model: "iPhone", systemVersion: "18"), "iPhone・iOS 18.0")
        XCTAssertEqual(SupportCore.deviceLabel(model: "iPad", systemVersion: "17.0"), "iPad・iOS 17.0")
        XCTAssertNil(SupportCore.deviceLabel(model: "Mac", systemVersion: "15.0"))
        for c in g["prices"]?.array ?? [] {
            let got = SupportCore.priceText(raw: c["raw"]?.string ?? "", currencyCode: c["code"]?.string ?? "", yen: c["yen"]?.int ?? 0)
            XCTAssertEqual(JSONValue.string(got), c["out"], "price \(String(describing: c["raw"])) \(String(describing: c["code"]))")
        }
        XCTAssertEqual(SupportCore.reviewHref, "https://apps.apple.com/app/id6794792375?action=write-review")
        // 規約の文（1 字ずつ）
        let d = g["docs"] ?? JSONValue.null
        XCTAssertEqual(JSONValue.string(DocsText.contact), d["contact"]); XCTAssertEqual(JSONValue.string(DocsText.appName), d["appName"])
        XCTAssertEqual(JSONValue.string(DocsText.appStoreId), d["appStoreId"]); XCTAssertEqual(JSONValue.string(DocsText.effective), d["effective"])
        XCTAssertEqual(JSONValue.string(DocsText.formURL), d["formURL"]); XCTAssertEqual(JSONValue.string(SupportCore.formURL), d["formURL"])
        XCTAssertEqual(JSONValue.array(DocsText.all.keys.sorted().map { JSONValue.string($0) }), JSONValue.array((d["keys"]?.array ?? []).sorted { ($0.string ?? "") < ($1.string ?? "") }))
        for (doc, w) in [(DocsText.privacy, d["privacy"]), (DocsText.terms, d["terms"])] {
            let got: JSONValue = ["key": JSONValue.string(doc.key), "title": JSONValue.string(doc.title), "lead": JSONValue.string(doc.lead),
                                  "sections": JSONValue.array(doc.sections.map { ["h": JSONValue.string($0.h), "p": JSONValue.array($0.p.map { JSONValue.string($0) })] })]
            XCTAssertEqual(got, w, "doc \(doc.key)")
        }
    }

    func testViews() throws {
        let g = try Self.fixture()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? JSONValue.null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["views"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let v = eng.supportView()
            let w = c["out"] ?? JSONValue.null
            check(JSONValue.bool(v.supporterShown), w["supporterShown"], "#\(i) supporterShown")
            if v.supporterShown {
                check(JSONValue.string(v.supporterTotal), w["supporterTotal"], "#\(i) total")
                check(JSONValue.string(v.supporterCount), w["supporterCount"], "#\(i) count")
                check(JSONValue.string(v.supporterSince), w["supporterSince"], "#\(i) since")
            }
            check(JSONValue.bool(v.tipShown), w["tipShown"], "#\(i) tipShown")
            check(JSONValue.array(v.tipRows.map { ["id": JSONValue.string($0.id), "label": JSONValue.string($0.label), "price": JSONValue.string($0.price), "pressed": JSONValue.bool($0.busy)] }), w["tipRows"], "#\(i) tipRows")
            check(JSONValue.bool(v.tipThanksShown), w["tipThanksShown"], "#\(i) thanks")
            if v.tipThanksShown {
                check(JSONValue.string(v.tipThanksId), w["tipThanksId"], "#\(i) thanksId")
                check(JSONValue.string(v.tipThanksPrice), w["tipThanksPrice"], "#\(i) thanksPrice")
            }
            if w["cardShown"] == JSONValue.bool(true) {
                check(JSONValue.string(v.cardOwner), w["cardOwner"], "#\(i) owner")
                check(JSONValue.string(v.cardOwnerShown), w["cardOwnerShown"], "#\(i) ownerShown")
                check(JSONValue.string(v.cardSince), w["cardSince"], "#\(i) since")
                check(JSONValue.string(v.cardTotal), w["cardTotal"], "#\(i) cardTotal")
                check(JSONValue.string(v.cardTimes), w["cardTimes"], "#\(i) times")
                check(JSONValue.array(v.cardHistory.map { ["when": JSONValue.string($0.when), "yen": JSONValue.string($0.yen)] }), w["cardHistory"], "#\(i) history")
                check(JSONValue.string(v.cardTierName), w["cardTierName"], "#\(i) tier")
                check(JSONValue.string(v.cardMarkColor), w["cardMarkColor"], "#\(i) mark")
                check(JSONValue.string(v.cardNextText), w["cardNextText"], "#\(i) next")
            }
            check(JSONValue.bool(v.probeShown), w["probeShown"], "#\(i) probe")
            if v.probeShown {
                check(JSONValue.array(v.probeRows.map { ["k": JSONValue.string($0.k), "val": JSONValue.string($0.val)] }), w["probeRows"], "#\(i) probeRows")
            }
        }
    }

    func testActions() throws {
        let g = try Self.fixture()
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? JSONValue.null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in (g["acts"]?.array ?? []).enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let ops = c["ops"]?.array ?? [], steps = c["steps"]?.array ?? []
            for (k, o) in ops.enumerated() {
                eng.now = o["now"]?.number ?? eng.now
                if o["skip"] != JSONValue.bool(true) {
                    let id = o["id"]?.string ?? ""
                    switch o["op"]?.string ?? "" {
                    case "buy": if eng.buyTipBegin(id) { eng.buyTipEnd(id, ok: true, msg: "") }
                    case "busyBuy":
                        eng.set(["tipBusy": JSONValue.string(SupportCore.tips[0].id)])
                        XCTAssertFalse(eng.buyTipBegin(id))
                        eng.set(["tipBusy": JSONValue.null])
                    case "close": eng.closeTipThanks()
                    case "thanksCard": eng.tipThanksCard()
                    case "openCard": eng.openCard()
                    case "cardBack": eng.cardBack()
                    case "name": eng.setSupporterName(o["s"]?.string ?? "")
                    default: break
                    }
                }
                let st = eng.state
                var gotO: [String: JSONValue] = [:]
                for key in ["supports", "tipThanks", "tipBusy", "screen", "cardAngle"] { gotO[key] = st[key] ?? JSONValue.null }
                gotO["supporterName"] = st["settings"]?["supporterName"] ?? JSONValue.null
                let got = JSONValue.object(gotO)
                let want = steps.indices.contains(k) ? steps[k] : JSONValue.null
                var w: [String: JSONValue] = [:]
                for key in ["supports", "tipThanks", "tipBusy", "screen", "cardAngle", "supporterName"] { w[key] = want[key] ?? JSONValue.null }
                check(got, JSONValue.object(w), "#\(i) step \(k) \(o["op"]?.string ?? "")")
            }
        }
    }
}
