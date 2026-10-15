import SwiftUI
import LukkoKit

/// 年月えらび（月表示の月名を押す）。‹ 2026 › で年を送り、12 か月から選ぶ。月の並びを横に払っても年が変わる
struct YMSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    /// 払いの向き（最初に 8px 動いたところで決める）
    @State var axisX: Bool?

    var body: some View {
        if let v = model.engine.ymSheetView() {
            VStack(spacing: 14) {
                HStack {
                    Button { model.act { $0.ymSheetShift(-1) } } label: {
                        Image(systemName: "chevron.left").font(.system(size: 17, weight: .medium)).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("前の年")
                    Spacer()
                    Text(v.year).font(.system(size: 20, weight: .semibold)).monospacedDigit().foregroundStyle(ink("ink"))
                        .accessibilityIdentifier("ym.year")
                    Spacer()
                    Button { model.act { $0.ymSheetShift(1) } } label: {
                        Image(systemName: "chevron.right").font(.system(size: 17, weight: .medium)).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("次の年")
                }
                .foregroundStyle(ink("ink-mut"))
                ZStack {
                    grid(v)
                        .id(v.year)
                        .transition(.asymmetric(insertion: .offset(x: CGFloat(30 * v.dir)).combined(with: .opacity), removal: .identity))
                }
                .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.24), value: v.year)
                .contentShape(Rectangle())
                .simultaneousGesture(
                    DragGesture(minimumDistance: 8)
                        .onChanged { g in
                            if axisX == nil { axisX = Engine.ymSheetAxisIsX(dx: g.translation.width, dy: g.translation.height) }
                        }
                        .onEnded { g in
                            let h = axisX ?? false
                            axisX = nil
                            model.act { $0.ymSheetSwipeEnd(horizontal: h, dx: g.translation.width) }
                        }
                )
                Button { model.act { $0.ymSheetToday() } } label: {
                    Text(v.todayLabel).font(.system(size: 14, weight: .medium)).foregroundStyle(ink("ink-soft"))
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 10)
            .presentationDetents([.height(400)])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(28)
            .presentationBackground(ink("card"))
        }
    }

    private func grid(_ v: YMSheetView) -> some View {
        // 12 か月を 4 列×3 行（Lazy でない Grid）
        Grid(horizontalSpacing: 8, verticalSpacing: 8) {
            ForEach(0..<3, id: \.self) { r in
                GridRow {
                    ForEach(v.months[(r * 4)..<(r * 4 + 4)], id: \.m) { mo in
                        Button { model.act { $0.ymSheetPick(mo.m) } } label: {
                            Text(mo.label).font(.system(size: 15, weight: mo.sel ? .bold : .medium))
                                .foregroundStyle(mo.sel ? ink("card") : ink("ink-soft"))
                                .frame(maxWidth: .infinity).padding(.vertical, 13)
                                .background(mo.sel ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(mo.sel ? ink("ink") : mo.isThis ? ink("ink-faint") : ink("line")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("ym.month.\(mo.m + 1)")
                        .accessibilityAddTraits(mo.sel ? .isSelected : [])
                    }
                }
            }
        }
    }
}
