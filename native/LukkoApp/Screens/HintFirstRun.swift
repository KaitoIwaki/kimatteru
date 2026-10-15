import SwiftUI
import LukkoKit

/// 予定が 0 件のあいだだけ浮かせて出す案内（Web 版の first-run）。✕ で閉じたら、もう出さない
struct HintFirstRun: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State var shown = false

    private static let green = Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255)

    var body: some View {
        let on = model.engine.showFirstRunHint()
        ZStack {
            if on && shown {
                card
                    .padding(.horizontal, 16)
                    .padding(.top, 70)
                    .transition(.offset(y: 14).combined(with: .opacity))
            }
        }
        .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.4), value: on && shown)
        .onAppear {
            // 少し遅れて浮かぶ（.2 秒）
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { shown = true }
        }
    }

    private var card: some View {
        VStack(spacing: 9) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 5).fill(Self.green).frame(width: 52, height: 15)
                RoundedRectangle(cornerRadius: 5).fill(Self.green.opacity(0.10))
                    .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(Self.green, style: StrokeStyle(lineWidth: 1.4, dash: [4, 3])))
                    .frame(width: 52, height: 15)
            }
            .accessibilityHidden(true)
            Text("決まっている予定は塗り、まだ分からない予定は点線で並びます。")
                .font(.system(size: 13)).foregroundStyle(ink("ink-soft")).lineSpacing(4)
                .multilineTextAlignment(.center)
            Text("下の ＋ から、最初の予定を置いてみてください")
                .font(.system(size: 12.5)).foregroundStyle(ink("ink-mut"))
                .multilineTextAlignment(.center)
            Button {
                Task { await model.engine.openImport() }
            } label: {
                Text("iPhone のカレンダーから取り込む")
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-soft"))
                    .padding(.horizontal, 20).padding(.vertical, 12)
                    .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
                    .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(ink("line")))
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20).padding(.horizontal, 22).padding(.bottom, 18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(ink("line")))
        .shadow(color: Color(red: 38 / 255, green: 37 / 255, blue: 31 / 255).opacity(0.10), radius: 15, y: 10)
        .overlay(alignment: .topTrailing) {
            Button { model.act { $0.closeFirstRunHint() } } label: {
                Text("✕").font(.system(size: 14)).foregroundStyle(ink("ink-faint")).frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .padding(4)
            .accessibilityLabel("この案内を閉じる")
        }
        .accessibilityIdentifier("month.firstRunHint")
    }
}
