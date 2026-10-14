import SwiftUI

/// 色。Web 版の styles.css の色（明るい／暗い）と、中身（LukkoKit）が返す色の書き方（"rgb(…)"・"var(--ink)"・"#fff"）を、SwiftUI の色にする
enum Palette {
    static let light: [String: String] = [
        "bg": "#F6F7F9", "bg2": "#EDEFF3", "card": "#FFFFFF", "line": "#E4E7EC", "line-faint": "#F1F3F6", "press": "#D8DCE4",
        "ink": "#1E2024", "ink-soft": "#4A4E55", "ink-mut": "#82878F", "ink-faint": "#B3B8C0", "sun": "#B4453A", "sat": "#3D6E9C", "today-bg": "#F7F8FA",
    ]
    static let dark: [String: String] = [
        "bg": "#0B0D10", "bg2": "#171C22", "card": "#12151A", "line": "#1F252D", "line-faint": "#171C22", "press": "#232A33",
        "ink": "#E7EBF0", "ink-soft": "#B4BCC6", "ink-mut": "#8A939F", "ink-faint": "#565F6B", "sun": "#CB7D75", "sat": "#779ABA", "today-bg": "#161A20",
    ]

    /// "var(--ink)"・"#1E2024"・"rgb(1,2,3)"・"rgba(1,2,3,.72)"・"transparent" を色にする
    static func color(_ css: String?, dark isDark: Bool) -> Color {
        guard let s0 = css?.trimmingCharacters(in: .whitespaces), !s0.isEmpty else { return .clear }
        if s0 == "transparent" { return .clear }
        if s0.hasPrefix("var(--"), s0.hasSuffix(")") {
            let name = String(s0.dropFirst(6).dropLast())
            return color((isDark ? dark : light)[name], dark: isDark)
        }
        if s0.hasPrefix("#") { return hex(s0) }
        if s0.hasPrefix("rgb") {
            guard let open = s0.firstIndex(of: "("), let close = s0.lastIndex(of: ")") else { return .clear }
            let parts = s0[s0.index(after: open)..<close].split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? .nan }
            guard parts.count >= 3, parts.prefix(3).allSatisfy({ $0.isFinite }) else { return .clear }
            let a = parts.count > 3 && parts[3].isFinite ? parts[3] : 1
            return Color(.sRGB, red: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255, opacity: a)
        }
        return .clear
    }
    static func hex(_ s: String) -> Color {
        var h = s.replacingOccurrences(of: "#", with: "")
        if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
        guard h.count >= 6, let v = UInt64(h.prefix(6), radix: 16) else { return .clear }
        return Color(.sRGB, red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255, opacity: 1)
    }
}

/// 画面のどこでも使う色（いまが暗い画面かを持って引く）
struct Ink {
    let dark: Bool
    func callAsFunction(_ name: String) -> Color { Palette.color("var(--\(name))", dark: dark) }
    func css(_ s: String?) -> Color { Palette.color(s, dark: dark) }
}

private struct InkKey: EnvironmentKey { static let defaultValue = Ink(dark: false) }
extension EnvironmentValues {
    var ink: Ink {
        get { self[InkKey.self] }
        set { self[InkKey.self] = newValue }
    }
}
