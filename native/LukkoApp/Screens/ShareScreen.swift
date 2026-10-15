import SwiftUI
import UIKit
import LukkoKit

/// 空いてる日をシェア（screen='share'）とまとめカード（screen='summary'）を、開いた画面の上にシートで出す。
/// どちらも Web 版では「来た画面（cardFrom）」へ閉じる。下へ払って閉じても同じ
struct ShareCovers: ViewModifier {
    /// この画面のタブ（month / free / report / settings）
    let from: String
    @Environment(AppModel.self) private var model

    /// share・summary を開いているときに、下のタブはどれにしておくか（来た画面のタブ）
    static func tab(_ st: [String: JSONValue]) -> String {
        let f = st["cardFrom"]?.string ?? ""
        if ["free", "report", "settings"].contains(f) { return f }
        if f.isEmpty { return st["screen"] == "share" ? "settings" : "month" }
        return "month"
    }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: binding("share") { $0.closeShare() }) {
                ShareScreen().environment(\.ink, Ink(dark: model.dark))
            }
            .sheet(isPresented: binding("summary") { $0.closeSummary() }) {
                SummaryCardScreen().environment(\.ink, Ink(dark: model.dark))
            }
    }

    private func binding(_ screen: String, close: @escaping (Engine) -> Void) -> Binding<Bool> {
        Binding(get: { model.state["screen"] == .string(screen) && Self.tab(model.state) == from },
                set: { on in if !on && model.state["screen"] == .string(screen) { model.act { close($0) } } })
    }
}

extension View {
    /// 空いてる日をシェア・まとめカードを、この画面から出す
    func shareCovers(from tab: String) -> some View { modifier(ShareCovers(from: tab)) }
}

/// シェアの画面で使う色（地は暗色で固定。書き出す PNG に合わせ、テーマに従わない）
enum ShareColors {
    static let bg = Color(red: 0x1A / 255, green: 0x1A / 255, blue: 0x1A / 255)
    static func hex(_ s: String) -> Color { Palette.hex(s) }
    static let paper = hex("#FFFDF8")
    static let coral = hex("#D85A30")
    static let coralDark = hex("#712B13")
    static let ink = hex("#26251F")
    static let inkMut = hex("#8C887C")
    static let line = hex("#E6E2D6")
    static let legendInk = hex("#55524A")
}

/// 空いてる日をシェア（Web 版 view.jsx の share 画面）
struct ShareScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    static let showPNG = ProcessInfo.processInfo.arguments.contains("-lukkoShowSharePNG")
    private var overlay: [[String: JSONValue]] { model.overlayFor(-1_000_000_000, 1_000_000_000) }

    var body: some View {
        let v = model.engine.shareView(overlay: overlay)
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    ShareFreePreview(v: v)
                        .accessibilityIdentifier("share.card")
                    Text("埋まっている日は灰色のマスだけ。何の予定かは相手に伝わりません。")
                        .font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                        .multilineTextAlignment(.center)
                        .padding(.top, 14)
                    options(v).padding(.top, 18)
                    buttons.padding(.top, 16)
                    if v.toast {
                        Text(v.toastMsg).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55))
                            .padding(.top, 12)
                            .transition(.opacity)
                    }
                    // 試験のときだけ：書き出す画像をそのまま下に出して、写真で確かめる
                    if Self.showPNG, let img = ShareImage.free(model.engine.freeCard(overlay: overlay)) {
                        Image(uiImage: img).resizable().scaledToFit().padding(.top, 24).accessibilityIdentifier("share.png")
                    }
                }
                .frame(maxWidth: 340)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 24)
                .animation(.easeOut(duration: 0.2), value: v.toast)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(ShareColors.bg)
            .navigationTitle("空いてる日をシェア")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ShareColors.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { model.act { $0.closeShare() } }.foregroundStyle(.white.opacity(0.65))
                }
            }
        }
        .environment(\.colorScheme, .dark)
        .presentationBackground(ShareColors.bg)
    }

    // 送り方。範囲・平日休日・言い回し・名前・送る文の見本・署名
    @ViewBuilder func options(_ v: ShareView) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ShareChipRow(chips: v.rangeChips) { c in model.act { $0.setShareOpt("range", c.value) } }
            ShareFlow(spacing: 6) {
                ShareChipRow.chips(v.onlyChips) { c in model.act { $0.setShareOpt("only", c.value) } }
                Color.clear.frame(width: 8, height: 1)
                ShareChipRow.chips(v.toneChips) { c in model.act { $0.setShareOpt("polite", c.value) } }
            }
            TextField("", text: Binding(get: { v.name }, set: { s in model.act { $0.setShareName(s) } }),
                      prompt: Text("名前を入れる（例：山田）").foregroundStyle(.white.opacity(0.35)))
                .font(.system(size: 14)).foregroundStyle(.white)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.white.opacity(0.18), lineWidth: 1))
                .submitLabel(.done)
                .accessibilityIdentifier("share.name")
            ScrollView {
                Text(v.text)
                    .font(.system(size: 12.5)).lineSpacing(12.5 * 0.75)
                    .foregroundStyle(.white.opacity(0.85))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding(.horizontal, 14).padding(.vertical, 12)
            }
            .frame(maxHeight: 160)
            .fixedSize(horizontal: false, vertical: true)
            .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
            .accessibilityIdentifier("share.text")
            Button { model.act { $0.toggleShareSign() } } label: {
                HStack(spacing: 10) {
                    ZStack {
                        if v.sign {
                            RoundedRectangle(cornerRadius: 5).fill(.white)
                            Text("✓").font(.system(size: 11, weight: .heavy)).foregroundStyle(ShareColors.bg)
                        } else {
                            RoundedRectangle(cornerRadius: 5).strokeBorder(.white.opacity(0.35), lineWidth: 1.5)
                        }
                    }
                    .frame(width: 18, height: 18)
                    Text("画像の下に「LUKKO で作成」の一言を入れる").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
                        .multilineTextAlignment(.leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("share.sign")
            .accessibilityAddTraits(v.sign ? .isSelected : [])
        }
    }

    var buttons: some View {
        HStack(spacing: 10) {
            Button { copyText() } label: {
                Text("文字でコピー").font(.system(size: 14.5, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(14)
                    .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(.white.opacity(0.2), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("share.copy")
            Button { shareImage() } label: {
                HStack(spacing: 7) {
                    ShareUpIcon().frame(width: 17, height: 17)
                    Text("画像で送る").font(.system(size: 14.5, weight: .bold))
                }
                .foregroundStyle(ink("ink"))
                .frame(maxWidth: .infinity).padding(14)
                .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("share.image")
        }
    }

    @MainActor private func copyText() {
        let ov = overlay
        model.act { e in
            e.copyFreeText(overlay: ov) { text in
                UIPasteboard.general.string = text
                return "コピーしました。LINE やメールに貼り付けてください"
            }
        }
    }

    @MainActor private func shareImage() {
        model.act { $0.shareCardTapped() }
        let card = model.engine.freeCard(overlay: overlay)
        guard let img = ShareImage.free(card), let url = ShareImage.writePNG(img, name: card.fileName) else {
            model.act { $0.shareCardFailed() }
            return
        }
        // 画像だけを渡す（文字も一緒に渡すと、画像を落とすアプリがある）
        ShareSheet.present([url]) { model.act { $0.shareCardDone(free: true) } }
    }
}

/// 送り方の札の 1 列（入りきらなければ折り返す。押すと tapLight）
struct ShareChipRow: View {
    let chips: [ShareView.Chip]
    let tap: (ShareView.Chip) -> Void
    var body: some View {
        ShareFlow(spacing: 6) { Self.chips(chips, tap) }
    }
    @ViewBuilder static func chips(_ chips: [ShareView.Chip], _ tap: @escaping (ShareView.Chip) -> Void) -> some View {
            ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                Button { tap(c) } label: {
                    Text(c.label).font(.system(size: 12.5)).lineLimit(1).fixedSize()
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .foregroundStyle(c.sel ? ShareColors.bg : .white.opacity(0.75))
                        .background(c.sel ? Color.white : Color.white.opacity(0.08), in: Capsule())
                        .overlay(Capsule().strokeBorder(c.sel ? Color.white : Color.white.opacity(0.18), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(c.sel ? .isSelected : [])
            }
    }
}

/// 横に並べ、入りきらなければ次の行へ（Web 版の flex-wrap）
struct ShareFlow: Layout {
    var spacing: CGFloat = 6
    private func rows(_ width: CGFloat, _ subviews: Subviews) -> [[(Int, CGSize)]] {
        var rows: [[(Int, CGSize)]] = [[]]
        var x: CGFloat = 0
        for (i, v) in subviews.enumerated() {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > width { rows.append([]); x = 0 }
            rows[rows.count - 1].append((i, s))
            x += s.width + spacing
        }
        return rows
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? .infinity
        let rs = rows(w, subviews)
        var h: CGFloat = 0
        var used: CGFloat = 0
        for (k, r) in rs.enumerated() {
            var rh: CGFloat = 0
            var rw: CGFloat = 0
            for (j, item) in r.enumerated() {
                rh = Swift.max(rh, item.1.height)
                rw += item.1.width
                if j > 0 { rw += spacing }
            }
            h += rh
            if k > 0 { h += spacing }
            used = Swift.max(used, rw)
        }
        return CGSize(width: proposal.width ?? used, height: h)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for r in rows(bounds.width, subviews) {
            var x = bounds.minX
            let rh = r.map { $0.1.height }.max() ?? 0
            for (i, s) in r {
                subviews[i].place(at: CGPoint(x: x, y: y + (rh - s.height) / 2), proposal: ProposedViewSize(s))
                x += s.width + spacing
            }
            y += rh + spacing
        }
    }
}

/// 上向きの矢印と箱（Web 版の共有の絵）
struct ShareUpIcon: View {
    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 24
            var a = Path()
            a.move(to: CGPoint(x: 12 * s, y: 15 * s)); a.addLine(to: CGPoint(x: 12 * s, y: 4 * s))
            a.move(to: CGPoint(x: 8 * s, y: 8 * s)); a.addLine(to: CGPoint(x: 12 * s, y: 4 * s)); a.addLine(to: CGPoint(x: 16 * s, y: 8 * s))
            var b = Path()
            b.move(to: CGPoint(x: 5 * s, y: 13 * s)); b.addLine(to: CGPoint(x: 5 * s, y: 18 * s))
            b.addQuadCurve(to: CGPoint(x: 7 * s, y: 20 * s), control: CGPoint(x: 5 * s, y: 20 * s))
            b.addLine(to: CGPoint(x: 17 * s, y: 20 * s))
            b.addQuadCurve(to: CGPoint(x: 19 * s, y: 18 * s), control: CGPoint(x: 19 * s, y: 20 * s))
            b.addLine(to: CGPoint(x: 19 * s, y: 13 * s))
            let st = StrokeStyle(lineWidth: 1.8 * s, lineCap: .round, lineJoin: .round)
            ctx.stroke(a, with: .foreground, style: st)
            ctx.stroke(b, with: .foreground, style: st)
        }
        .accessibilityHidden(true)
    }
}

/// 見本のカード（Web 版の share 画面の白いカード。地も字も固定色）
struct ShareFreePreview: View {
    let v: ShareView
    private let cols = Array(repeating: GridItem(.flexible(), spacing: 5), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text("○").font(.system(size: 12, weight: .heavy)).foregroundStyle(.white)
                    .frame(width: 22, height: 22)
                    .background(ShareColors.coral, in: RoundedRectangle(cornerRadius: 7))
                Text(v.lead).font(.system(size: 13)).foregroundStyle(ShareColors.coral)
            }
            .padding(.bottom, 3)
            Text(v.title).font(.system(size: 22, weight: .light)).tracking(-0.5).foregroundStyle(ShareColors.ink)
            Text("予定の中身は出していません").font(.system(size: 13)).foregroundStyle(ShareColors.inkMut)
                .padding(.top, 2).padding(.bottom, 18)
            LazyVGrid(columns: cols, spacing: 5) {
                ForEach(Array(v.weekdays.enumerated()), id: \.offset) { _, w in
                    Text(w).font(.system(size: 10, weight: .semibold)).foregroundStyle(ShareColors.hex("#B0B4BB"))
                }
            }
            .padding(.bottom, 4)
            LazyVGrid(columns: cols, spacing: 5) {
                ForEach(Array(v.cells.enumerated()), id: \.offset) { _, c in cell(c) }
            }
            HStack(spacing: 12) {
                legend(0) { RoundedRectangle(cornerRadius: 5).fill(ShareColors.hex("#FAECE7")).overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(ShareColors.coral, lineWidth: 1.5)) }
                legend(1) { RoundedRectangle(cornerRadius: 5).fill(ShareColors.paper).overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(ShareColors.coral, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))) }
                legend(2) { RoundedRectangle(cornerRadius: 5).fill(ShareColors.hex("#EDEEF0")) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
            .overlay(alignment: .top) { Rectangle().fill(ShareColors.line).frame(height: 1) }
            .padding(.top, 18)
        }
        .padding(.horizontal, 22).padding(.top, 24).padding(.bottom, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 22).fill(ShareColors.paper)
                .shadow(color: .black.opacity(0.5), radius: 24, y: 18)
        }
        .environment(\.colorScheme, .light)
    }

    @ViewBuilder func legend<S: View>(_ i: Int, _ swatch: () -> S) -> some View {
        HStack(spacing: 6) {
            swatch().frame(width: 16, height: 16)
            Text(i < v.legend.count ? v.legend[i] : "").font(.system(size: 12)).foregroundStyle(ShareColors.legendInk).lineLimit(1).fixedSize()
        }
    }

    @ViewBuilder func cell(_ c: ShareView.Cell) -> some View {
        if let n = c.label {
            let shape = RoundedRectangle(cornerRadius: 7)
            VStack(spacing: 0) {
                Text("\(n)").monospacedDigit()
                    .font(.system(size: c.level == "free" ? 13 : 12, weight: c.level == "free" || c.level == "part" ? .bold : .regular))
                if !c.note.isEmpty && c.level == "part" {
                    Text(c.note).font(.system(size: 8, weight: .semibold)).foregroundStyle(ShareColors.coral).lineLimit(1).minimumScaleFactor(0.8)
                }
            }
            .foregroundStyle(c.level == "busy" ? ShareColors.hex("#C1C5CC") : c.level == "past" ? ShareColors.hex("#D9DBDF") : ShareColors.coralDark)
            .frame(maxWidth: .infinity).frame(height: 38)
            .background {
                switch c.level {
                case "busy": shape.fill(ShareColors.hex("#EDEEF0"))
                case "past": shape.fill(ShareColors.hex("#F6F6F4"))
                case "part": shape.fill(ShareColors.paper).overlay(shape.strokeBorder(ShareColors.coral, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])))
                default: shape.fill(ShareColors.hex("#FAECE7")).overlay(shape.strokeBorder(ShareColors.coral, lineWidth: 1.5))
                }
            }
            .accessibilityElement(children: .combine)
        } else {
            Color.clear.frame(height: 38)
        }
    }
}
