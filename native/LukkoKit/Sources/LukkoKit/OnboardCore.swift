import Foundation

/// はじめての案内の中身（Web 版 renderVals の「はじめての案内」の写し）
public struct OnboardView: Equatable {
    public struct Prof: Equatable { public var key: String, label: String, note: String, sel: Bool }
    public var step = 0
    public var fast = false
    public var profiles: [Prof] = []
    /// 1 枚目の見本（今日の日付・塗りの予定・点線の予定・問い）
    public var dateText = "", solidLabel = "", demoLabel = "", askHeading = ""
    public var asking = false, filled = false, done = false
    public var caption = "", captionGreen = false
    /// 「つぎへ」（1 枚目）：済みなら黒、まだなら控えめな地
    public var nextDark = false
    public var morningOn = false
    /// 見本のピルの色（塗り＝遊びの色、点線＝緑）
    public var solidBg = "", solidLine = "", solidInk = ""
    public var dashBg = "", dashLine = "", dashInk = "", fillBg = ""
}

public enum OnboardCore {
    /// 使い方ごとの見本の言葉（点線の予定・塗りの予定・問い）
    public static let demo: [String: [String]] = [
        "student": ["カフェバイト", "映画", "このシフト、どうなりました？"], "work": ["打ち合わせ", "定例", "この仮押さえ、どうなった？"],
        "shift": ["希望休", "日勤", "この休み、通りましたか？"], "free": ["〇〇社 打ち合わせ", "納品", "この仮押さえ、どうなった？"],
        "family": ["保育園の面談", "歯医者", "この予定、どうなりました？"],
    ]
    /// 使い方の説明（PROFILES の note）
    public static let notes = ["student": "授業・サークル・バイト", "work": "会議・打ち合わせ・出張", "shift": "看護・介護・販売・飲食など",
                               "free": "案件・打ち合わせ・納期", "family": "保育園・学校行事・通院"]
    static let teal = "#1D9E75"
}

extension Engine {
    /// はじめての案内の中身
    public func onboardView(sysDark: Bool = false) -> OnboardView {
        let c = core()
        let ob = state["onboard"] ?? .null
        let dark = c.isDark(sysDark: sysDark)
        var v = OnboardView()
        v.step = JS.int(ob["step"])
        v.fast = JS.truthy(ob["fast"])
        v.profiles = Profile.keys.map { k in .init(key: k, label: Profile.all[k]?.label ?? "", note: OnboardCore.notes[k] ?? "", sel: ob["picked"] == .string(k)) }
        let picked = JS.truthy(ob["picked"]) ? JS.string(ob["picked"]) : c.profile()
        let demo = OnboardCore.demo[picked] ?? OnboardCore.demo["student"]!
        let n = JSDate.local(now, timeZone)
        v.dateText = "\(n.m + 1)月\(n.d)日（\(FormCore.dow[Civil.weekday(n.y, n.m, n.d)])）"
        v.morningOn = JS.truthy(ob["morning"])
        let d = ob["demo"]
        v.asking = d == "asking"
        v.filled = d == "fill" || d == "done"
        v.done = d == "done"
        v.askHeading = demo[2]
        v.demoLabel = v.filled ? demo[0] : "？" + demo[0]
        v.caption = v.filled ? "決まった、が形になりました。" : v.asking ? "押すと、この予定が塗りに変わります。" : "↑ 点線の予定をタップしてみてください"
        v.captionGreen = v.filled
        v.nextDark = v.done
        v.solidLabel = demo[1]
        let teal = OnboardCore.teal
        let at = typesList.first { $0["key"] == "asobi" }
        let ac = at.map { JS.string($0["color"]) } ?? "#B4453A"
        v.solidBg = c.softFill(ac, dark: dark); v.solidLine = c.softLine(ac, dark: dark); v.solidInk = c.inkOn(ac, dark: dark)
        v.fillBg = c.softFill(teal, dark: dark)
        v.dashBg = v.filled ? v.fillBg : JS.string(c.paperShow(.string(TypeDefs.paperOf(teal)), dark: dark))
        v.dashLine = c.softLine(teal, dark: dark)
        v.dashInk = c.inkOn(teal, dark: dark)
        return v
    }

    /// 画面を押したら、演出を飛ばして全部出す
    public func onboardFast() {
        if JS.truthy(state["onboard"]?["fast"]) { return }
        patchOnboard(["fast": true])
    }
}
