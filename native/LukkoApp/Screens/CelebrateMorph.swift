import SwiftUI
import LukkoKit

/// 「決まった」の瞬間の帯（2.3 で作り直し。見本の B）。
///
/// 前は、小窓が閉じるのと同時に塗りが走り、ほとんど小窓の陰で終わっていた。いまは小窓が閉じきってから：
/// 0.45s 点線が閉じて実線に → 0.5s 塗りが弾むように満ちる（カチッ）→ 0.9s ぽんっと膨らんで着地し、
/// 帯のまわりに輪が広がり、右端に緑のチェック（トン）→ 1.6s で終わり、ふつうの塗りの帯に戻る。
/// 時刻は画面側の時計で進める（予定が決まる時刻は Engine の dlgPrimary のまま。正解表と合わせるため）
struct CelebrateMorphBar: View {
    /// 色と文字（点線のときの見た目。AppCore.morphBar の dash）
    let m: MonthCore.Morph
    let start: Date
    let height: CGFloat
    let scale: Double
    let left: Bool, right: Bool
    @Environment(\.ink) private var ink
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    static let duration = 1.6

    var body: some View {
        TimelineView(.animation) { ctx in
            frame(ctx.date.timeIntervalSince(start))
        }
        .accessibilityLabel(m.text)
    }

    // MARK: 時刻 → 見た目
    private static func clamp(_ x: Double) -> Double { min(1, max(0, x)) }
    /// 少し行き過ぎて戻る（塗り・チェック）
    private static func back(_ x: Double, _ s: Double = 1.2) -> Double {
        let p = clamp(x) - 1
        return 1 + (s + 1) * p * p * p + s * p * p
    }
    private static func easeOut(_ x: Double) -> Double { let p = clamp(x); return 1 - (1 - p) * (1 - p) }
    /// 着地：1 → 1.12 → 0.98 → 1（0.45 秒）
    private static func pop(_ t: Double) -> Double {
        let x = (t - 0.9) / 0.45
        if x <= 0 || x >= 1 { return 1 }
        if x < 0.35 { return 1 + 0.12 * easeOut(x / 0.35) }
        if x < 0.7 { return 1.12 - 0.14 * easeOut((x - 0.35) / 0.35) }
        return 0.98 + 0.02 * easeOut((x - 0.7) / 0.3)
    }

    @ViewBuilder private func frame(_ t: Double) -> some View {
        let calm = reduceMotion
        let fillP = calm ? (t >= 0.45 ? 1 : 0) : min(1.04, Self.back((t - 0.5) / 0.42, 0.8))
        let solid = t >= 0.6
        let borderOp = (t > 0.45 && t < 0.6) ? 0.4 : 1.0
        let ringP = Self.clamp((t - 0.9) / 0.6)
        let ckIn = calm ? (t >= 0.9 ? 1 : 0) : Self.back((t - 0.9) / 0.5, 2.0)
        let ckOut = 1 - Self.clamp((t - 1.4) / 0.2)
        let r: CGFloat = 3
        let shape = UnevenRoundedRectangle(topLeadingRadius: left ? r : 0, bottomLeadingRadius: left ? r : 0,
                                           bottomTrailingRadius: right ? r : 0, topTrailingRadius: right ? r : 0)
        let line = ink.css(String(m.border.split(separator: " ", maxSplits: 2).last ?? ""))
        HStack(spacing: 0) {
            if t < 0.5 {
                Text("?").font(.system(size: 9 * scale, weight: .heavy)).opacity(0.75).padding(.trailing, 2).fixedSize()
            }
            Text(m.text).font(.system(size: 10 * scale, weight: .medium)).tracking(-0.4)
                .lineLimit(1).truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .foregroundStyle(ink.css(m.ink))
        .padding(.horizontal, 3)
        .frame(height: height)
        .background {
            ZStack(alignment: .leading) {
                shape.fill(ink.css(m.background.string))
                GeometryReader { g in
                    Rectangle().fill(ink.css(m.fill)).frame(width: g.size.width * max(0, fillP))
                }
            }
        }
        .overlay {
            OpenSidesRect(left: left, right: right, radius: r)
                .stroke(line, style: StrokeStyle(lineWidth: 1.5, dash: solid ? [] : [4, 3]))
                .opacity(borderOp)
        }
        .overlay(alignment: .trailing) {
            // 着地の瞬間に出る緑のチェック（帯の右の端の段にだけ）
            if right && t >= 0.9 {
                Circle().fill(FormTone.teal)
                    .overlay { Image(systemName: "checkmark").font(.system(size: height * 0.42, weight: .heavy)).foregroundStyle(.white) }
                    .frame(width: height * 0.78, height: height * 0.78)
                    .scaleEffect(max(0, ckIn))
                    .opacity(ckOut)
                    .padding(.trailing, 2)
            }
        }
        .clipShape(shape)
        .background {
            // まわりに広がる輪
            if !calm && t >= 0.9 && ringP < 1 {
                RoundedRectangle(cornerRadius: r + 2).stroke(line, lineWidth: 2)
                    .scaleEffect(x: 1 + 0.35 * ringP, y: 1 + 0.9 * ringP)
                    .opacity(0.7 * (1 - ringP))
            }
        }
        .scaleEffect(calm ? 1 : Self.pop(t))
    }
}

/// 今月の点線が全部片づいたときの、画面全体のお祝い（2.3）。約 2.2 秒で消える。触っても下の画面がそのまま使える
struct MilestoneOverlay: View {
    let info: AppModel.Milestone
    let onFinish: () -> Void
    @Environment(\.ink) private var ink
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    static let duration = 2.2
    private struct Piece { let x, delay, dx, rot, w, h: Double; let color: Color }
    private static let colors: [Color] = [FormTone.teal, Color(red: 0.82, green: 0.57, blue: 0.42), Color(red: 0.61, green: 0.55, blue: 0.78),
                                          Color(red: 0.91, green: 0.71, blue: 0.30), Color(red: 0.50, green: 0.68, blue: 0.52)]
    /// 紙吹雪（毎回同じ並び。乱数を使わない）
    private static let pieces: [Piece] = (0..<40).map { i in
        func f(_ k: Double) -> Double { let v = sin(Double(i) * 12.9898 + k * 78.233) * 43758.5453; return v - v.rounded(.down) }
        return Piece(x: 0.04 + 0.92 * f(1), delay: 0.35 * f(2), dx: f(3) * 120 - 60, rot: f(4) * 540 - 270, w: 6 + 3 * f(5), h: 9 + 5 * f(6),
                     color: colors[i % colors.count])
    }

    var body: some View {
        TimelineView(.animation) { ctx in
            let t = ctx.date.timeIntervalSince(start)
            GeometryReader { g in
                ZStack {
                    RadialGradient(colors: [FormTone.teal.opacity(0.16), FormTone.teal.opacity(0)], center: UnitPoint(x: 0.5, y: 0.42),
                                   startRadius: 0, endRadius: g.size.width * 0.8)
                        .opacity(veil(t))
                    if !reduceMotion {
                        Canvas { c, size in
                            for p in Self.pieces {
                                let x = (t - p.delay) / 1.9
                                guard x > 0, x < 1 else { continue }
                                let e = 1 - pow(1 - x, 1.6)
                                var cc = c
                                cc.opacity = 1 - x * x
                                cc.translateBy(x: size.width * p.x + p.dx * e, y: -20 + (size.height + 40) * e)
                                cc.rotate(by: .degrees(p.rot * e))
                                cc.fill(Path(roundedRect: CGRect(x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h), cornerRadius: 2), with: .color(p.color))
                            }
                        }
                    }
                    card
                        .scaleEffect(reduceMotion ? 1 : cardScale(t))
                        .opacity(cardOpacity(t))
                        .position(x: g.size.width / 2, y: g.size.height * 0.42)
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("milestone.celebrate")
        .task {
            try? await Task.sleep(nanoseconds: UInt64(Self.duration * 1_000_000_000))
            onFinish()
        }
    }

    private var card: some View {
        VStack(spacing: 6) {
            Text("今月の予定、\nぜんぶ決まりました").font(.system(size: 20, weight: .heavy)).multilineTextAlignment(.center).foregroundStyle(ink("ink"))
            Text("\(info.m + 1)月の点線が、なくなりました。").font(.system(size: 12.5)).foregroundStyle(ink("ink-mut"))
            HStack(spacing: 8) {
                Text("決まった \(info.decided)件").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 4).background(FormTone.teal, in: Capsule())
                Text("まだ 0件").font(.system(size: 12, weight: .bold)).foregroundStyle(FormTone.teal)
                    .padding(.horizontal, 12).padding(.vertical, 4)
                    .overlay(Capsule().strokeBorder(FormTone.teal, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
            }
            .padding(.top, 6)
        }
        .padding(.horizontal, 26).padding(.vertical, 20)
        .frame(width: 290)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.16), radius: 25, y: 12)
    }

    private func veil(_ t: Double) -> Double {
        let x = t / Self.duration
        if x < 0.2 { return x / 0.2 }
        if x > 0.8 { return max(0, (1 - x) / 0.2) }
        return 1
    }
    private func cardScale(_ t: Double) -> Double {
        let x = t / Self.duration
        if x < 0.14 { return 0.8 + 0.24 * (x / 0.14) }
        if x < 0.22 { return 1.04 - 0.04 * ((x - 0.14) / 0.08) }
        if x > 0.82 { return 1 - 0.04 * ((x - 0.82) / 0.18) }
        return 1
    }
    private func cardOpacity(_ t: Double) -> Double {
        let x = t / Self.duration
        if x < 0.14 { return x / 0.14 }
        if x > 0.82 { return max(0, (1 - x) / 0.18) }
        return 1
    }
}
