import SwiftUI
import LukkoKit

/// 応援の画面（settingsview.jsx の SupportPage）。お礼 → 芽の絵 → 金額 3 つ → 手書きの「いつもありがとう」。
/// 色はカレンダーの予定の緑（セージ）と、アプリの地・カードの色だけで作る
struct SupportPage: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let sv = model.engine.supportView()
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    Text("いつも使ってくださって、\nありがとうございます。").font(SupportFont.yomogi(22)).foregroundStyle(ink("ink")).lineSpacing(8)
                    Text("あなたの応援が、\nこれからの開発の力になります。").font(SupportFont.yomogi(13)).foregroundStyle(ink("ink-mut")).lineSpacing(10)
                }
                .multilineTextAlignment(.center)
                .padding(.top, 18).padding(.horizontal, 8).padding(.bottom, 6)

                SupportSprout(width: 150).padding(.top, 22).padding(.bottom, 26)

                Text("応援する").font(SupportFont.yomogi(13)).foregroundStyle(SupportFont.sageDark).padding(.bottom, 10)
                VStack(spacing: 8) {
                    ForEach(sv.tipRows, id: \.id) { t in
                        Button { Task { await SupportStore.shared.buy(t.id, model) } } label: {
                            HStack(spacing: 13) {
                                SupportTipIcon(kind: t.icon).frame(width: 40, height: 40).background(ink("bg2"), in: Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(t.title).font(SupportFont.yomogi(15)).foregroundStyle(ink("ink"))
                                    if !t.sub.isEmpty { Text(t.sub).font(SupportFont.yomogi(11.5)).foregroundStyle(ink("ink-mut")) }
                                }
                                Spacer(minLength: 0)
                                Text(t.price).font(SupportFont.yomogi(15)).monospacedDigit().foregroundStyle(SupportFont.sageDark)
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
                            }
                            .padding(.leading, 11).padding(.trailing, 13).padding(.vertical, 11)
                            .background(t.busy ? ink("press") : ink("card"), in: RoundedRectangle(cornerRadius: 17))
                            .shadow(color: .black.opacity(0.04), radius: 1, y: 1)
                        }
                        .buttonStyle(SettingsPressStyle(radius: 17))
                        .accessibilityIdentifier("tip.\(t.id)")
                    }
                }
                .padding(.bottom, 28)

                // 手書きふうの「いつもありがとう」
                VStack(spacing: 0) {
                    Text("いつも").font(SupportFont.yomogi(16))
                    Text("ありがとう").font(SupportFont.yomogi(16))
                    SettingsSVGPath(d: "M2 10C25 3 55 1 88 4", box: 90)
                        .stroke(ink("ink-faint"), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                        .frame(width: 90, height: 90).frame(height: 12, alignment: .top).clipped()
                }
                .foregroundStyle(ink("ink-mut"))
                .rotationEffect(.degrees(-6))
                .padding(.top, 10)

                SupportWave().fill(ink("bg2")).frame(height: 60).padding(.horizontal, -16).padding(.top, 26)
            }
            .padding(.horizontal, 16)
        }
        .background(ink("bg").ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) { Text("応援する").font(SupportFont.yomogi(16)).foregroundStyle(ink("ink")) }
        }
        .toolbarRole(.editor)
    }
}

/// 下の波（375×60 の絵を横に伸ばす）
struct SupportWave: Shape {
    func path(in r: CGRect) -> Path {
        let sx = r.width / 375, sy = r.height / 60
        var p = Path()
        p.move(to: CGPoint(x: 0, y: 22 * sy))
        p.addCurve(to: CGPoint(x: 200 * sx, y: 18 * sy), control1: CGPoint(x: 70 * sx, y: 4 * sy), control2: CGPoint(x: 140 * sx, y: 4 * sy))
        p.addCurve(to: CGPoint(x: 375 * sx, y: 22 * sy), control1: CGPoint(x: 260 * sx, y: 32 * sy), control2: CGPoint(x: 320 * sx, y: 42 * sy))
        p.addLine(to: CGPoint(x: 375 * sx, y: 60 * sy))
        p.addLine(to: CGPoint(x: 0, y: 60 * sy))
        p.closeSubpath()
        return p.applying(CGAffineTransform(translationX: r.minX, y: r.minY))
    }
}

/// 芽の線画（イラスト：GreenStock40「芽生えのイラスト（線画）」。商用・アプリで利用可、クレジット不要）
struct SupportSprout: View {
    let width: CGFloat
    @Environment(\.ink) private var ink
    var body: some View {
        Image("Sprout").resizable().renderingMode(.template).foregroundStyle(ink("ink"))
            .scaledToFit().frame(width: width)
            .accessibilityHidden(true)
    }
}

/// 応援のあとの「ありがとう」
struct SupportThanksSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let sv = model.engine.supportView()
        VStack(spacing: 0) {
            SupportSprout(width: 96).padding(.bottom, 14)
            Text("応援、\nありがとうございます！").font(SupportFont.yomogi(21)).foregroundStyle(ink("ink")).multilineTextAlignment(.center).lineSpacing(6)
            HStack(spacing: 8) {
                SupportTipIcon(kind: sv.tipThanksIcon.isEmpty ? "heart" : sv.tipThanksIcon)
                Text(sv.tipThanksTitle).font(SupportFont.yomogi(14)).foregroundStyle(ink("ink"))
                Text(sv.tipThanksPrice).font(SupportFont.yomogi(14)).monospacedDigit().foregroundStyle(SupportFont.sageDark)
            }
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(ink("card"), in: Capsule())
            .padding(.top, 14).padding(.bottom, 20)
            Button { model.act { $0.tipThanksCard() } } label: {
                Text("サポーターカードを見る").font(SupportFont.yomogi(15)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(13).background(SupportFont.sage, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(SettingsPressStyle(radius: 14))
            .accessibilityIdentifier("thanks.card")
            Button { model.act { $0.closeTipThanks() } } label: {
                Text("閉じる").font(SupportFont.yomogi(14)).foregroundStyle(ink("ink-mut")).frame(maxWidth: .infinity).padding(12)
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(.horizontal, 26).padding(.top, 30).padding(.bottom, 18)
        .frame(maxWidth: 340)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ink("bg").ignoresSafeArea())
        .presentationDetents([.height(440)])
        .presentationDragIndicator(.visible)
    }
}

/// 課金の診断（版の字を 5 回叩くと出る）
struct SupportProbeSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let sv = model.engine.supportView()
        VStack(alignment: .leading, spacing: 0) {
            Text("課金の状態").font(.system(size: 14.5)).foregroundStyle(ink("ink")).padding(.bottom, 12)
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(sv.probeRows.enumerated()), id: \.offset) { _, r in
                        VStack(alignment: .leading, spacing: 2) {
                            if !r.k.isEmpty { Text(r.k).font(.system(size: 11)).foregroundStyle(ink("ink-mut")) }
                            Text(r.val).font(.system(size: 12.5, design: .monospaced)).foregroundStyle(ink("ink")).lineSpacing(4).textSelection(.enabled)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button { Task { await SupportStore.shared.sendWidgetNow(model) } } label: {
                Text("ウィジェットに送る").font(.system(size: 14)).foregroundStyle(ink("ink-soft")).frame(maxWidth: .infinity).padding(11).background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain).padding(.top, 14)
            HStack(spacing: 8) {
                Button { Task { await SupportStore.shared.runProbe(model) } } label: {
                    Text("もう一度読む").font(.system(size: 14)).foregroundStyle(ink("ink-soft")).frame(maxWidth: .infinity).padding(11).background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                Button { model.act { $0.setProbe(nil) } } label: {
                    Text("閉じる").font(.system(size: 14, weight: .bold)).foregroundStyle(ink("card")).frame(maxWidth: .infinity).padding(11).background(ink("ink"), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 8)
        }
        .padding(18)
        .background(ink("card").ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
