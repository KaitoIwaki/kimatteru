import Foundation

/// 応援（投げ銭）とサポーターカード。Web 版 tipjar.js・cardflip.js・cardtexture.js・App.jsx（CARD_TIERS・FLECKS・formHref）の写し。
///
/// 応援は何も解放しない。機能を渡した瞬間、応援ではなく機能販売になる。
/// 消耗型なので「購入の復元」も無い（復元するものが無い）。買った記録は supports に入れ、予定と同じ保存と控えに入る
public enum SupportCore {
    public struct Tip: Equatable { public let id: String; public let yen: Int; public let label: String }
    /// App Store Connect に登録してある商品（tipjar.js の TIPS）
    public static let tips: [Tip] = [
        Tip(id: "com.kimatteru.app.tip300", yen: 300, label: "コーヒー1杯"),
        Tip(id: "com.kimatteru.app.tip600", yen: 600, label: "ランチ1回"),
        Tip(id: "com.kimatteru.app.tip1000", yen: 1000, label: "しっかり応援"),
    ]
    public struct Look: Equatable { public let title: String; public let sub: String; public let icon: String }
    /// 画面に出す題と一言と絵（settingsview.jsx の TIP_LOOK）
    public static let looks: [String: Look] = [
        "com.kimatteru.app.tip300": Look(title: "コーヒー1杯", sub: "ちょっとした応援を、気軽に。", icon: "cup"),
        "com.kimatteru.app.tip600": Look(title: "ランチ1回", sub: "次のアイデアのために。", icon: "rice"),
        "com.kimatteru.app.tip1000": Look(title: "しっかり応援", sub: "もっと良いものをつくるために。", icon: "heart"),
    ]
    public static func look(_ id: String, label: String) -> Look { looks[id] ?? Look(title: label, sub: "", icon: "heart") }

    /// 画面に出す値段（tipjar.js の priceText）。ふだんは App Store の文字そのまま。円で返らなかったときだけ、こちらの円に置き換える
    public static func priceText(raw: String, currencyCode: String, yen: Int) -> String {
        let code = currencyCode.uppercased()
        let isYen = !code.isEmpty ? code == "JPY" : (raw.contains("¥") || raw.contains("￥") || raw.contains("円"))
        if !raw.isEmpty && isYen { return raw }
        return "¥" + JS.groupedInt(Double(yen))
    }

    // MARK: 外へのリンク（App.jsx の formHref・docs.js）
    public static let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSewSGJ40HFVLD_Ogylt1NfyJ5Ek1w2j0vNudQo5A6PzBIzArw/viewform"
    public static let formEntry = (kind: "entry.282144982", device: "entry.2064364294", version: "entry.581874367")
    public static let reviewHref = "https://apps.apple.com/app/id" + DocsText.appStoreId + "?action=write-review"
    public static let supportHref = "https://kaitoiwaki.github.io/kimatteru/legal/support.html"

    /// 事前入力つきのフォームのアドレス。device は「iPhone・iOS 18.1」の形（分からなければ nil）
    public static func formHref(version: String, kind: String, device: String?) -> String {
        var q = ["usp=pp_url"]
        if !kind.isEmpty { q.append(formEntry.kind + "=" + encodeURIComponent(kind)) }
        if let device { q.append(formEntry.device + "=" + encodeURIComponent(device)) }
        if !version.isEmpty { q.append(formEntry.version + "=" + encodeURIComponent(version)) }
        return formURL + "?" + q.joined(separator: "&")
    }
    /// 端末の名前（Web 版は UA の「iPhone … OS 18_1」から作る。こちらは機種と iOS の版から同じ形に）
    public static func deviceLabel(model: String, systemVersion: String) -> String? {
        let kind = model.hasPrefix("iPad") ? "iPad" : (model.hasPrefix("iPhone") ? "iPhone" : nil)
        guard let kind else { return nil }
        let p = systemVersion.split(separator: ".").map(String.init)
        guard let major = p.first, Int(major) != nil else { return nil }
        let minor = p.count > 1 && Int(p[1]) != nil ? p[1] : "0"
        return "\(kind)・iOS \(major).\(minor)"
    }
    /// JS の encodeURIComponent
    public static func encodeURIComponent(_ s: String) -> String {
        let keep = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()".utf8)
        var out = ""
        for b in s.utf8 {
            if keep.contains(b) { out.append(Character(Unicode.Scalar(b))) } else { out += String(format: "%%%02X", b) }
        }
        return out
    }

    /// 診断の「課金の状態」の行（App.jsx の probeRows）
    public static func probeRows(_ p: JSONValue) -> [(k: String, val: String)] {
        if JS.truthy(p["running"]) { return [("", "読み込み中…")] }
        let nl = "\n"
        let asked = (p["asked"]?.array ?? []).map { JS.string($0) }
        let got = (p["got"]?.array ?? []).map { JS.string($0) }
        let w = p["widget"]
        let widgetLast: String
        if !JS.truthy(w) || !JS.truthy(w?["last"]) { widgetLast = "（まだ渡していない）" }
        else if JS.truthy(w?["last"]?["ok"]) { widgetLast = "渡せた（\(JS.string(w?["last"]?["days"]))日ぶん・\(JS.string(w?["last"]?["size"]))文字）" }
        else { widgetLast = "渡せなかった：\(JS.string(w?["last"]?["why"]))" }
        let billing = p["billing"]
        return [
            ("ネイティブか", JS.truthy(p["native"]) ? "はい" : "いいえ（ブラウザ）"),
            ("課金が使えるか", billing == .null ? "—" : (JS.truthy(billing) ? "はい" : "いいえ")),
            ("聞いた製品ID", asked.joined(separator: nl)),
            ("返ってきた数", String(got.count)),
            ("返ってきたID", got.isEmpty ? "（なし）" : got.joined(separator: nl)),
            ("エラー", JS.truthy(p["error"]) ? JS.string(p["error"]) : "（なし）"),
            ("ウィジェットの窓口", JS.truthy(w) ? (JS.truthy(w?["there"]) ? "ある" : "ない") : "—"),
            ("ウィジェットへ渡した結果", widgetLast),
        ]
    }
}

// MARK: - カードを指で回す（cardflip.js）
/// 角度ひとつだけを本当のこととして、表と裏のどちらが見えるかも、落ち着き先も、すべてそこから出す
public enum SupporterFlip {
    /// 0 以上 360 未満に直す
    public static func norm(_ deg: Double) -> Double { (deg.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) }
    /// その角度で表が手前を向いているか（90°〜270° が裏）
    public static func showsFront(_ deg: Double) -> Bool { let a = norm(deg); return a < 90 || a >= 270 }
    /// なぞった長さを角度にする。カードの幅いっぱいでちょうど半回転
    public static func dragToDeg(_ dx: Double, _ width: Double) -> Double { width > 0 ? (dx / width) * 180 : 0 }
    public static let tiltMax = 8.0
    static let tiltK = 0.08
    /// 上下になぞった長さを傾きにする。下へなぞると手前の縁が下がる
    public static func tiltFor(_ dy: Double) -> Double { max(-tiltMax, min(tiltMax, -dy * tiltK)) }
    /// 速く払ったと見なす速さ（度/秒）
    public static let flick = 260.0
    /// 指を離したとき、どこで落ち着くか
    public static func settle(_ deg: Double, _ vel: Double = 0) -> Double {
        if abs(vel) >= flick {
            return vel > 0 ? (deg / 180).rounded(.down) * 180 + 180 : (deg / 180).rounded(.up) * 180 - 180
        }
        return JS.round(deg / 180) * 180
    }
    public static let turn = 0.56
    /// 落ち着くまでの時間（秒）。半回転で 0.56 秒
    public static func settleTime(_ from: Double, _ to: Double) -> Double { max(0.16, min(0.6, (abs(to - from) / 180) * turn)) }
    static let springA = 5.0, springB = 4.88
    /// 落ち着き方の曲線（減衰したばね。約 4% 行き過ぎて戻る）
    public static func ease(_ t: Double) -> Double {
        if t <= 0 { return 0 }
        if t >= 1 { return 1 }
        let e = Foundation.exp(-springA * t)
        return 1 - e * (Foundation.cos(springB * t) + (springA / springB) * Foundation.sin(springB * t))
    }

    /// その角度のときの影（cardShadow の数）。2 枚：接地の影と、環境の影
    public struct Shadow: Equatable {
        public var nearX: Double, nearY: Double, nearBlur: Double, nearAlpha: Double
        public var x: Double, y: Double, blur: Double, alpha: Double
        /// CSS の box-shadow と同じ書き方（試験で Web 版と比べる）
        public var css: String {
            func n(_ v: Double) -> String { JS.numberToString(v) }
            return ["\(n(nearX))px \(n(nearY))px \(n(nearBlur))px rgba(38,37,31,\(SupporterFlip.fixed3(nearAlpha)))",
                    "\(n(x))px \(n(y))px \(n(blur))px rgba(38,37,31,\(SupporterFlip.fixed3(alpha)))",
                    "inset 2px 2px 3px -2px rgba(255,251,232,.75)",
                    "inset -2px -2px 3px -2px rgba(42,28,2,.5)",
                    "inset 0 1px 0 rgba(255,255,255,.5)",
                    "inset 0 -1px 0 rgba(0,0,0,.14)"].joined(separator: ", ")
        }
    }
    public static func shadow(_ deg: Double, back: Bool = false) -> Shadow {
        let rad = deg * Double.pi / 180
        let lift = abs(Foundation.sin(rad))
        let x = JS.round(-16 * Foundation.sin(rad) * (back ? -1 : 1))
        return Shadow(nearX: JS.round(x * 0.2), nearY: JS.round(2 + 2 * lift), nearBlur: JS.round(3 + 3 * lift), nearAlpha: 0.26 + 0.06 * lift,
                      x: x, y: JS.round(14 - 5 * lift), blur: JS.round(34 + 16 * lift), alpha: 0.18 + 0.1 * lift)
    }
    /// JS の (n).toFixed(3)
    public static func fixed3(_ v: Double) -> String { String(format: "%.3f", v) }
}

// MARK: - カードの段（App.jsx の CARD_TIERS）
public struct SupporterTier: Equatable {
    public let key: String, min: Int, name: String
    /// 紙の色（斜め 150° のグラデーションに等間隔で置く）
    public let paper: [String]
    public let foil: String, mark: String, sheen: String, edge: String
    /// 箔の粒（生成りの紙には撒かない）
    public let fleck: String?
    /// 向きに連れて動く光の帯（色と位置％）
    public let glint: [(color: String, at: Double)]
    public static func == (a: SupporterTier, b: SupporterTier) -> Bool { a.key == b.key }

    public static let all: [SupporterTier] = [
        SupporterTier(key: "normal", min: 0, name: "ノーマル", paper: ["#F3EEE2", "#E7DFCE", "#F3EEE2"], foil: "#6B582F", mark: "#C8BFA6",
                      sheen: "rgba(255,252,240,.5)", edge: "rgba(107,88,47,.3)", fleck: nil,
                      glint: [("rgba(255,255,255,0)", 32), ("rgba(255,252,238,.42)", 50), ("rgba(255,255,255,0)", 68)]),
        SupporterTier(key: "gold", min: 1000, name: "ゴールド", paper: ["#FDF6D6", "#D9B85F", "#F7E8AC", "#C9A544", "#F2DE9B"], foil: "#513706", mark: "#A9862C",
                      sheen: "rgba(255,250,214,.45)", edge: "rgba(81,55,6,.44)", fleck: "#FFFDF0",
                      glint: [("rgba(255,255,255,0)", 30), ("rgba(255,246,200,.5)", 44), ("rgba(237,251,217,.6)", 50), ("rgba(255,239,192,.5)", 56), ("rgba(255,255,255,0)", 70)]),
        SupporterTier(key: "black", min: 3000, name: "ブラック", paper: ["#2B2823", "#1B1915", "#2B2823"], foil: "#D8BC72", mark: "#7C6E4C",
                      sheen: "rgba(255,240,196,.24)", edge: "rgba(216,188,114,.38)", fleck: "#F0DFA8",
                      glint: [("rgba(255,255,255,0)", 32), ("rgba(255,240,196,.22)", 50), ("rgba(255,255,255,0)", 68)]),
    ]
    /// 合計金額から段を決める（その額に達したら上がる）
    public static func tierFor(_ total: Int) -> SupporterTier {
        var out = all[0]
        for t in all where total >= t.min { out = t }
        return out
    }
    /// 次の段（いちばん上なら nil）
    public static func nextTier(_ total: Int) -> SupporterTier? { all.first { total < $0.min } }
    /// 紙の色の位置（％。Math.round(i*100/(n-1))）
    public var paperStops: [(color: String, at: Double)] {
        paper.enumerated().map { i, c in (c, JS.round(Double(i * 100) / Double(paper.count - 1))) }
    }
    /// 箔の粒の居場所（％）と、光りはじめるまでの間（秒）。決め打ち（回すたびに飛び移らないように）
    public static let flecks: [(x: Double, y: Double, delay: Double)] = [
        (12, 72, 0), (26, 34, 1.4), (38, 82, 2.9), (47, 18, 0.6), (58, 62, 3.7), (66, 28, 1.9),
        (74, 90, 4.6), (83, 46, 2.3), (91, 66, 5.4), (19, 50, 3.1), (53, 40, 6.2), (88, 20, 4.1),
    ]
}

// MARK: - カードの肌理（cardtexture.js）
/// 刷り目（ヘアライン）と粒子。画面と書き出しの両方で同じ数を使う
public enum SupporterTexture {
    public static let brushN = 150, grainN = 900, tile = 64.0
    public static let brushLight = (255.0, 255.0, 255.0), brushDark = (42.0, 28.0, 2.0)
    public static let grainLight = (255.0, 253.0, 240.0), grainDark = (58.0, 42.0, 8.0)
    /// 決め打ちの擬似乱数
    public static func rnd(_ n: Double) -> Double {
        let x = Foundation.sin(n * 12.9898) * 43758.5453
        return x - x.rounded(.down)
    }
    public struct Line: Equatable { public var x1, y1, x2, y2, width, op: Double; public var light: Bool }
    public struct Dot: Equatable { public var x, y, s: Double; public var light: Bool }
    /// 刷り目。左下から右上へ
    public static func brushLines(_ w: Double, _ h: Double) -> [Line] {
        var out: [Line] = []
        for i in 0..<brushN {
            let j: Double = rnd(Double(i + 1))
            let step: Double = (Double(i) * (w + h)) / Double(brushN)
            let x: Double = -h + step
            let width: Double = 0.35 + j * 0.5
            let op: Double = 0.020 + j * 0.030
            out.append(Line(x1: x, y1: h, x2: x + h, y2: 0, width: width, op: op, light: i % 3 == 0))
        }
        return out
    }
    /// 粒子。明暗を半々に
    public static func grainDots(_ w: Double, _ h: Double) -> [Dot] {
        var out: [Dot] = []
        for i in 0..<grainN { out.append(dot(i, w, h)) }
        return out
    }
    /// 画面用の粒の型（64px 四方。全面と同じ密度）
    public static func tileDots(_ w: Double = 335, _ h: Double = 211) -> [Dot] {
        let area: Double = w * h
        let dense: Double = Double(grainN) * tile * tile
        let n = Int(JS.round(dense / area))
        var out: [Dot] = []
        for i in 0..<max(0, n) { out.append(dot(i, tile, tile)) }
        return out
    }
    static func dot(_ i: Int, _ w: Double, _ h: Double) -> Dot {
        let a: Double = Double(i * 2 + 1), b: Double = Double(i * 2 + 2)
        let x: Double = rnd(a) * w
        let y: Double = rnd(b) * h
        return Dot(x: x, y: y, s: 0.8, light: i % 2 == 1)
    }
    /// 粒の濃さ（明るい粒 5%・暗い粒 3.5%）
    public static func grainAlpha(_ light: Bool) -> Double { light ? 0.05 : 0.035 }
}

// MARK: - 画面の中身
/// 設定の応援の行・応援の画面・お礼の小窓・サポーターカードの中身（App.jsx の renderVals のうち応援の部分）
public struct SupportView {
    public struct TipRow: Equatable { public var id: String, label: String, title: String, sub: String, icon: String, price: String, busy: Bool }
    public var supporterShown = false, supporterTotal = "", supporterCount = "", supporterSince = ""
    public var tipShown = false
    public var tipRows: [TipRow] = []
    public var tipThanksShown = false, tipThanksId = "", tipThanksTitle = "", tipThanksIcon = "", tipThanksPrice = ""
    // カード
    public var cardOwner = "", cardOwnerShown = "", cardSince = "", cardTotal = "", cardTimes = ""
    public var cardHistory: [(when: String, yen: String)] = []
    public var tier = SupporterTier.all[0]
    public var cardTierName = "", cardMarkColor = "", cardNextText = ""
    public var total = 0
    public var probeShown = false
    public var probeRows: [(k: String, val: String)] = []
}

extension Engine {
    var supportsList: [Obj] { (state["supports"]?.array ?? []).compactMap { $0.object } }

    public func supportView() -> SupportView {
        var v = SupportView()
        let sup = supportsList
        let tips = (state["tips"]?.array ?? []).compactMap { $0.object }
        let total = sup.reduce(0) { $0 + Int(JS.toInt32($1["yen"])) }
        v.total = total
        func ym(_ ms: Double) -> JSDate.Parts { JSDate.local(ms, timeZone) }
        func p2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }
        let first = sup.map { JS.number($0["at"]) }.min() ?? .nan
        v.supporterShown = !sup.isEmpty
        if !sup.isEmpty {
            let d = ym(first)
            v.supporterCount = sup.count == 1 ? "1回" : "\(sup.count)回"
            v.supporterTotal = "¥" + JS.groupedInt(Double(total))
            v.supporterSince = "\(d.y)年\(d.m + 1)月から"
        }
        v.tipShown = !tips.isEmpty
        let busy = state["tipBusy"]
        v.tipRows = tips.map { t in
            let id = JS.string(t["id"]), lk = SupportCore.look(id, label: JS.string(t["label"]))
            let b = busy == t["id"] && JS.truthy(busy)
            return .init(id: id, label: JS.string(t["label"]), title: lk.title, sub: lk.sub, icon: lk.icon, price: b ? "…" : JS.string(t["price"]), busy: b)
        }
        if let th = state["tipThanks"], JS.truthy(th) {
            let id = JS.string(th["id"])
            v.tipThanksShown = true
            v.tipThanksId = id
            let lk = SupportCore.looks[id] ?? SupportCore.Look(title: "応援", sub: "", icon: "heart")
            v.tipThanksTitle = lk.title; v.tipThanksIcon = lk.icon
            if let t = tips.first(where: { $0["id"] == th["id"] }) { v.tipThanksPrice = JS.string(t["price"]) }
            else if let t0 = SupportCore.tips.first(where: { $0.id == id }) { v.tipThanksPrice = "¥" + JS.groupedInt(Double(t0.yen)) }
        }
        // カード
        if !sup.isEmpty {
            let d = ym(first)
            v.cardOwner = JS.trim(JS.string(JS.or(settings["supporterName"], "")))
            v.cardOwnerShown = v.cardOwner.isEmpty ? "名前を入れる" : v.cardOwner
            v.cardSince = "MEMBER SINCE \(d.y).\(p2(d.m + 1))"
            v.cardTotal = "¥" + JS.groupedInt(Double(total))
            v.cardTimes = "\(sup.count)回"
            v.cardHistory = JS.stableSorted(sup) { a, b in JS.sign(JS.number(b["at"]) - JS.number(a["at"])) }.map { x in
                let p = ym(JS.number(x["at"]))
                return ("\(p.y).\(p2(p.m + 1)).\(p2(p.d))", "¥" + JS.groupedInt(Double(JS.toInt32(x["yen"]))))
            }
        }
        let tier = SupporterTier.tierFor(total)
        v.tier = tier
        v.cardTierName = tier.name
        v.cardMarkColor = tier.mark
        if let nx = SupporterTier.nextTier(total) { v.cardNextText = "あと ¥\(JS.groupedInt(Double(nx.min - total))) で\(nx.name)カードになります" }
        else { v.cardNextText = "いちばん上の段です。ありがとうございます。" }
        if let p = state["probe"], JS.truthy(p) {
            v.probeShown = true
            v.probeRows = SupportCore.probeRows(p)
        }
        return v
    }

    // MARK: 応援の操作
    /// App Store から取れた値段を入れる（[{id, yen, label, price}]）。取れなければ入れない（行ごと出さない）
    public func setTips(_ list: [JSONValue]) { if !list.isEmpty { set(["tips": .array(list)]) } }
    /// 買い始め。返事待ちの間の二度押しは受けない（false）
    public func buyTipBegin(_ id: String) -> Bool {
        if JS.truthy(state["tipBusy"]) { return false }
        haptic("light")
        set(["tipBusy": .string(id)])
        return true
    }
    /// 買い終わり。成功なら supports に {id, yen, at} を足してお礼を出す。やめたときは何も言わない
    public func buyTipEnd(_ id: String, ok: Bool, msg: String) {
        set(["tipBusy": .null, "pressed": .null])
        if ok {
            let yen = SupportCore.tips.first { $0.id == id }?.yen ?? 0
            let rec: JSONValue = ["id": .string(id), "yen": .number(Double(yen)), "at": .number(now)]
            set(["supports": .array((state["supports"]?.array ?? []) + [rec]), "tipThanks": ["id": .string(id)]])
            haptic("success")
            return
        }
        if !msg.isEmpty { toast(msg) }
    }
    public func closeTipThanks() { haptic("light"); set(["tipThanks": .null]) }
    /// お礼の小窓から「サポーターカードを見る」
    public func tipThanksCard() { haptic("light"); set(["tipThanks": .null, "screen": "card", "cardAngle": 0]) }
    /// 設定の「サポーターカード」
    public func openCard() { haptic("light"); set(["screen": "card", "cardAngle": 0]) }
    public func cardBack() { set(["screen": "settings"]) }
    /// カードに載せる名前（20 文字まで、空でもよい）
    public func setSupporterName(_ s: String) { setSetting("supporterName", .string(JS.slice16(s, 20))) }
    /// 診断の中身（{running:true} か結果。nil で閉じる）
    public func setProbe(_ p: JSONValue?) { set(["probe": p ?? .null]) }
}
