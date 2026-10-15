import SwiftUI
import LukkoKit

/// 月表示の下に浮かせるもの：シフト入力のパレット（入力中）か、給料バー（給料オンのとき）
struct MonthBottomBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let stamp = model.engine.stampBarView()
        let wageOn = JS.truthy(model.state["wageOn"]) && model.engine.wageFeatureOn()
        VStack(spacing: 0) {
            if let stamp {
                StampPalette(v: stamp)
                    .transition(.offset(y: 14).combined(with: .opacity))
            } else if wageOn {
                // シフト入力中は給料バーを出さない
                WageBar(v: model.engine.wageBarView())
                    .transition(.offset(y: 14).combined(with: .opacity))
            }
        }
        .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.28), value: stamp != nil)
        .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.3), value: wageOn)
    }
}

/// シフト入力のパレット。型を選んで、マスを押すだけで置く。同じマスをもう一度押すと外れる
struct StampPalette: View {
    let v: StampBarView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Array(v.tpls.enumerated()), id: \.offset) { _, t in
                        Button { model.act { $0.stampPick(t.key) } } label: {
                            VStack(spacing: 1) {
                                Text(t.label).font(.system(size: 14, weight: .bold)).lineLimit(1)
                                Text(t.sub).font(.system(size: 10)).monospacedDigit().opacity(0.7).lineLimit(1)
                            }
                            .foregroundStyle(t.sel ? ink("card") : ink("ink"))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(t.sel ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(t.sel ? ink("ink") : ink("line")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(t.sel ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 12)
            }
            .padding(.bottom, 8)
            HStack(spacing: 8) {
                Picker("シフトの状態", selection: Binding(get: { v.seg.first { $0.sel }?.key ?? "kakutei" }, set: { k in model.act { $0.stampSetStatus(k) } })) {
                    ForEach(v.seg, id: \.key) { Text($0.label).tag($0.key) }
                }
                .pickerStyle(.segmented)
                Button { model.act { $0.toggleStamp() } } label: {
                    Text("おわる").font(.system(size: 12.5, weight: .bold)).foregroundStyle(ink("card"))
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(ink("ink"), in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("stamp.end")
            }
            .padding(.horizontal, 12)
            Button { model.act { $0.confirmMonthShifts() } } label: {
                Text(v.monthLabel).font(.system(size: 11.5)).underline().foregroundStyle(ink("ink-mut"))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
        }
        .padding(.top, 10).padding(.bottom, 12)
        .background(.regularMaterial)
        .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
        .accessibilityIdentifier("stamp.palette")
    }
}

/// 給料バー：「10月の実績合計 ¥金額 ›」。押すとその月のまとめカード
struct WageBar: View {
    let v: WageBarView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        Button { model.act { $0.openWageSummary() } } label: {
            HStack {
                // ラベルは小さく薄く字間を開けて、数字は大きく細く。記号は数字より一段小さく
                Text(v.label).font(.system(size: 11)).tracking(1.1).foregroundStyle(ink("ink-mut"))
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(v.unit).font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                    Text(v.num).font(.system(size: 26, weight: .light)).tracking(-0.3).monospacedDigit().foregroundStyle(ink("ink"))
                    Text("›").font(.system(size: 16)).foregroundStyle(ink("ink-faint")).padding(.leading, 6)
                }
            }
            .padding(.horizontal, 22).padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(.regularMaterial)
        .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
        .accessibilityLabel("\(v.label) \(v.total)")
        .accessibilityIdentifier("month.wageBar")
    }
}
