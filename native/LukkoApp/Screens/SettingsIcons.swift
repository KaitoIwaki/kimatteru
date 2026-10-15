import SwiftUI

/// Web 版の設定で使っている小さな線画（SVG の path）を、そのままの線で描く。
/// 絵は settingsview.jsx に書いてある d をそのまま写す（24×24 の座標）
struct SettingsSVGPath: Shape {
    let d: String
    var box: CGFloat = 24

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / box
        let raw = Self.parse(d)
        return raw.applying(CGAffineTransform(translationX: rect.minX + (rect.width - box * s) / 2, y: rect.minY + (rect.height - box * s) / 2).scaledBy(x: s, y: s))
    }

    /// M m L l H h V v C c S s A a Z z だけ（ここで使う絵に要るぶん）
    static func parse(_ d: String) -> Path {
        var p = Path()
        let tokens = tokenize(d)
        var i = 0
        var cmd: Character = "M"
        var cur = CGPoint.zero, start = CGPoint.zero, lastCtrl: CGPoint? = nil
        func num() -> CGFloat {
            guard i < tokens.count, case .num(let n) = tokens[i] else { return 0 }
            i += 1; return n
        }
        func hasNum() -> Bool { i < tokens.count && { if case .num = tokens[i] { return true } else { return false } }() }
        while i < tokens.count {
            if case .cmd(let c) = tokens[i] { cmd = c; i += 1 } else if !hasNum() { i += 1; continue }
            let rel = cmd.isLowercase
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { rel ? CGPoint(x: cur.x + x, y: cur.y + y) : CGPoint(x: x, y: y) }
            switch cmd.uppercased().first! {
            case "M":
                let q = pt(num(), num()); p.move(to: q); cur = q; start = q; lastCtrl = nil
                cmd = rel ? "l" : "L"   // 続く数は直線
            case "L": let q = pt(num(), num()); p.addLine(to: q); cur = q; lastCtrl = nil
            case "H": let x = num(); let q = CGPoint(x: rel ? cur.x + x : x, y: cur.y); p.addLine(to: q); cur = q; lastCtrl = nil
            case "V": let y = num(); let q = CGPoint(x: cur.x, y: rel ? cur.y + y : y); p.addLine(to: q); cur = q; lastCtrl = nil
            case "C":
                let c1 = pt(num(), num()), c2 = pt(num(), num()), q = pt(num(), num())
                p.addCurve(to: q, control1: c1, control2: c2); cur = q; lastCtrl = c2
            case "S":
                let c1 = lastCtrl.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                let c2 = pt(num(), num()), q = pt(num(), num())
                p.addCurve(to: q, control1: c1, control2: c2); cur = q; lastCtrl = c2
            case "A":
                let rx = num(), ry = num(), rot = num(), large = num() != 0, sweep = num() != 0
                let q = pt(num(), num())
                arc(&p, from: cur, to: q, rx: rx, ry: ry, rot: rot, large: large, sweep: sweep); cur = q; lastCtrl = nil
            case "Z": p.closeSubpath(); cur = start; lastCtrl = nil
            default: i += 1
            }
            if cmd.uppercased() == "Z" { cmd = "M" }
        }
        return p
    }

    enum Tok { case cmd(Character), num(CGFloat) }
    static func tokenize(_ d: String) -> [Tok] {
        var out: [Tok] = []
        let chars = Array(d)
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if c.isLetter && c != "e" && c != "E" { out.append(.cmd(c)); i += 1; continue }
            if c == "-" || c == "+" || c == "." || c.isNumber {
                var j = i
                var s = ""
                if chars[j] == "-" || chars[j] == "+" { s.append(chars[j]); j += 1 }
                var dot = false
                while j < chars.count, chars[j].isNumber || (chars[j] == "." && !dot) {
                    if chars[j] == "." { dot = true }
                    s.append(chars[j]); j += 1
                }
                out.append(.num(CGFloat(Double(s) ?? 0)))
                i = max(j, i + 1)
                continue
            }
            i += 1
        }
        return out
    }

    /// SVG の弧を、ベジェ曲線に直して足す（仕様書の F.6 のとおり）
    static func arc(_ p: inout Path, from p0: CGPoint, to p1: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat, rot: CGFloat, large: Bool, sweep: Bool) {
        if p0 == p1 { return }
        var rx = abs(rx0), ry = abs(ry0)
        if rx == 0 || ry == 0 { p.addLine(to: p1); return }
        let phi = rot * .pi / 180, cp = cos(phi), sp = sin(phi)
        let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
        let x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy
        let lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lam > 1 { rx *= sqrt(lam); ry *= sqrt(lam) }
        let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var co = sqrt(max(0, num / den))
        if large == sweep { co = -co }
        let cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx
        let cx = cp * cx1 - sp * cy1 + (p0.x + p1.x) / 2, cy = sp * cx1 + cp * cy1 + (p0.y + p1.y) / 2
        func ang(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a
        }
        let t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep && dt > 0 { dt -= 2 * .pi } else if sweep && dt < 0 { dt += 2 * .pi }
        let segs = max(1, Int(ceil(abs(dt) / (.pi / 2))))
        let step = dt / CGFloat(segs)
        let k = 4.0 / 3.0 * tan(step / 4)
        func at(_ t: CGFloat) -> (CGPoint, CGPoint) {
            let x = rx * cos(t), y = ry * sin(t)
            let dxp = -rx * sin(t), dyp = ry * cos(t)
            return (CGPoint(x: cp * x - sp * y + cx, y: sp * x + cp * y + cy), CGPoint(x: cp * dxp - sp * dyp, y: sp * dxp + cp * dyp))
        }
        var t = t1
        for _ in 0..<segs {
            let (a, da) = at(t), (b, db) = at(t + step)
            p.addCurve(to: b, control1: CGPoint(x: a.x + k * da.x, y: a.y + k * da.y), control2: CGPoint(x: b.x - k * db.x, y: b.y - k * db.y))
            t += step
        }
    }
}

/// 線で描く小さな絵（24×24）。線の色・太さは Web 版と同じ
struct SettingsLineIcon: View {
    let paths: [String]
    var color: Color
    var width: CGFloat = 1.6
    var size: CGFloat = 20
    var filled: [String] = []
    var fill: Color = .clear
    var body: some View {
        ZStack {
            ForEach(Array(filled.enumerated()), id: \.offset) { _, d in SettingsSVGPath(d: d).fill(fill) }
            ForEach(Array(paths.enumerated()), id: \.offset) { _, d in
                SettingsSVGPath(d: d).stroke(color, style: StrokeStyle(lineWidth: width * size / 24, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size, height: size)
    }
}

/// 設定で使う絵（settingsview.jsx の svg）
enum SettingsIcon {
    static let calendar = ["M6.5 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z", "M3.5 9.5h17M8 3v4M16 3v4"]
    static let free = ["M3.5 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z", "m13 15 2.8-6 2.8 6Z"]
    static let bell = ["M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z", "M10 20.5a2 2 0 0 0 4 0"]
    static let yen = ["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0Z", "m9 7.5 3 4.5 3-4.5M9 12.5h6M9 15.5h6M12 12v6"]
    static let phone = ["M9.5 3h5a2.5 2.5 0 0 1 2.5 2.5v13a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.5v-13A2.5 2.5 0 0 1 9.5 3Z", "M11 18h2"]
    static let shield = ["M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6Z", "m9 12 2.2 2.2L15.5 10"]
    static let help = ["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0Z", "M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8v.2"]
    static let star = ["m12 3.6 2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.3 6.9 19l1.1-5.6-4.2-3.9 5.7-.7Z"]
    static let sproutStem = ["M12 21v-9"]
    static let sproutLeaves = ["M12 12c0-3.6-2.6-6-6.6-6 0 3.8 2.6 6 6.6 6Z", "M12 10.5c0-3.4 2.4-5.6 6.4-5.6 0 3.6-2.4 5.6-6.4 5.6Z"]
    // 応援の 3 つ（TipIcon）
    static let cup = ["M5 10h11v4.5A4.5 4.5 0 0 1 11.5 19h-2A4.5 4.5 0 0 1 5 14.5z", "M16 11.5h1.3a2.2 2.2 0 0 1 0 4.4H15.6", "M9 4.5c-.8 1 .8 1.7 0 2.8M12 4.5c-.8 1 .8 1.7 0 2.8"]
    static let rice = ["M12 4.5c2 0 3.4 1.6 4.6 3.8l2.4 4.6c1.3 2.6-.5 6.1-3.4 6.1H8.4c-2.9 0-4.7-3.5-3.4-6.1l2.4-4.6C8.6 6.1 10 4.5 12 4.5z", "M9 14h6v5H9z"]
    static let heart = ["M12 19.5s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.3c0 4.9-7 9.2-7 9.2z"]
}

/// 芽の小さな絵（「LUKKO を応援する」の行）
struct SettingsSproutIcon: View {
    var body: some View {
        let sage = Palette.hex("#7FAE85"), line = Palette.hex("#6E9E75")
        ZStack {
            ForEach(SettingsIcon.sproutLeaves, id: \.self) { d in SettingsSVGPath(d: d).fill(sage.opacity(0.3)) }
            SettingsLineIcon(paths: SettingsIcon.sproutStem, color: line, width: 1.8, size: 22)
            SettingsLineIcon(paths: SettingsIcon.sproutLeaves, color: line, width: 1.6, size: 22)
        }
        .frame(width: 22, height: 22)
    }
}

/// 応援の絵（cup・rice・heart）
struct SupportTipIcon: View {
    let kind: String
    @Environment(\.ink) private var ink
    var body: some View {
        switch kind {
        case "cup": SettingsLineIcon(paths: SettingsIcon.cup, color: ink("ink-soft"))
        case "rice": SettingsLineIcon(paths: SettingsIcon.rice, color: ink("ink-soft"), filled: [SettingsIcon.rice[1]], fill: ink("ink-soft"))
        default: SettingsLineIcon(paths: SettingsIcon.heart, color: ink("ink-soft"))
        }
    }
}
