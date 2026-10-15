import SwiftUI
import LukkoKit

/// 「決まった」の瞬間（Web 版の pillView の morph）。
///
/// 小窓で「決まった」を押すと、その予定の月の月表示へ戻り、帯が
/// 点線（dash）→ 150ms で左から右へ塗りが満ちる（.3s、ペンの「チッ」）→ 470ms で少し膨らんで着地（.2s、成功の手ごたえ）
/// → 760ms で確定を保存。時刻と手ごたえは中身（Engine の dlgPrimary）が進め、ここは見た目だけを動かす
struct CelebrateMorphBar: View {
    let m: MonthCore.Morph
    let height: CGFloat
    let scale: Double
    let left: Bool, right: Bool
    @Environment(\.ink) private var ink
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 塗りの満ち具合（0 → 1）
    @State var fill: CGFloat = 0

    var body: some View {
        let r: CGFloat = 3
        let shape = UnevenRoundedRectangle(topLeadingRadius: left ? r : 0, bottomLeadingRadius: left ? r : 0,
                                           bottomTrailingRadius: right ? r : 0, topTrailingRadius: right ? r : 0)
        let line = String(m.border.split(separator: " ", maxSplits: 2).last ?? "")
        HStack(spacing: 0) {
            if !m.mark.isEmpty {
                Text(m.mark).font(.system(size: 9 * scale, weight: .heavy)).opacity(0.75).padding(.trailing, 2).fixedSize()
                    .transition(.opacity)
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
                // 左から右へ満ちる塗り
                GeometryReader { g in
                    RoundedRectangle(cornerRadius: 2).fill(ink.css(m.fill))
                        .frame(width: g.size.width * fill)
                }
            }
        }
        .overlay {
            OpenSidesRect(left: left, right: right, radius: r)
                .stroke(ink.css(line), style: StrokeStyle(lineWidth: 1.5, dash: m.dashed ? [4, 3] : []))
                .animation(.linear(duration: 0.14), value: m.dashed)
        }
        .clipShape(shape)
        // 着地：少しだけ膨らんで戻る（pillSettle：.2s、45% で 1.04 倍）
        .keyframeAnimator(initialValue: 1.0, trigger: m.settle) { content, s in
            content.scaleEffect(s)
        } keyframes: { _ in
            CubicKeyframe(m.settle && !reduceMotion ? 1.04 : 1.0, duration: 0.09)
            CubicKeyframe(1.0, duration: 0.11)
        }
        .onAppear { if m.fillOn { fill = 1 } }
        .onChange(of: m.fillOn) { _, on in
            guard on else { return }
            if reduceMotion { fill = 1; return }
            withAnimation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.3)) { fill = 1 }
        }
        .accessibilityLabel(m.text)
    }
}
