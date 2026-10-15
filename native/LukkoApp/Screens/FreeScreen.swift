import SwiftUI
import LukkoKit

/// いつ空いてる？（Web 版の screen='free'）。1 日 1 行、右の印を押すと ○→△→× と回す
struct FreeScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let fy = model.state["freeYM"] ?? .null
        let y = JS.int(fy["y"]), m = JS.int(fy["m"])
        // 重ねて表示している iPhone の予定も数える（設定で「空き状況にも入れる」をオンにしたとき。日ごとの絞り込みは中身の側）
        let v = model.core.freeView(y, m, dark: model.dark, overlay: model.overlayFor(-1_000_000_000, 1_000_000_000))
        let emptyShown = (model.state["events"]?.array ?? []).isEmpty && JS.truthy(model.state["settings"]?["onboarded"])
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    HStack(spacing: 14) {
                        Button { withAnimation(.snappy(duration: 0.26)) { model.act { $0.shiftFree(-1) } } } label: { Image(systemName: "chevron.left") }
                            .accessibilityLabel("前の月")
                        Text("\(v.monthLabel)月").font(.system(size: 16)).monospacedDigit().foregroundStyle(ink("ink")).frame(minWidth: 44)
                        Button { withAnimation(.snappy(duration: 0.26)) { model.act { $0.shiftFree(1) } } } label: { Image(systemName: "chevron.right") }
                            .accessibilityLabel("次の月")
                    }
                    .font(.system(size: 17)).foregroundStyle(ink("ink-mut"))
                    Spacer()
                    HStack(spacing: 12) {
                        Text("○\(v.cO)").foregroundStyle(Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255))
                        Text("△\(v.cA)").foregroundStyle(Color(red: 0xB9 / 255, green: 0x77 / 255, blue: 0x0F / 255))
                        Text("×\(v.cX)").foregroundStyle(Color(red: 0xC1 / 255, green: 0xC5 / 255, blue: 0xCC / 255))
                    }
                    .font(.system(size: 13, weight: .bold).monospacedDigit())
                }
                .padding(.horizontal, 18).padding(.top, 6).padding(.bottom, 12)
                List {
                    // 予定が 1 件も無いと全部「○」で意味を持たない。取り込みを勧めるのはここ
                    if emptyShown {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("まだ予定がありません").font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink"))
                            Text("予定を入れると、その日が空いているかどうかがここに出ます。")
                                .font(.system(size: 12.5)).lineSpacing(12.5 * 0.9).foregroundStyle(ink("ink-soft"))
                            Button { Task { await model.engine.openImport() } } label: {
                                Text("iPhone のカレンダーから取り込む").font(.system(size: 14, weight: .bold)).foregroundStyle(ink("ink"))
                                    .frame(maxWidth: .infinity).padding(12)
                                    .background(ink("card"), in: RoundedRectangle(cornerRadius: 13))
                                    .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(ink("line"), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .padding(.top, 8)
                        }
                        .padding(.horizontal, 17).padding(.vertical, 16)
                        .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 16))
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 14, leading: 14, bottom: 4, trailing: 14))
                    }
                    ForEach(v.rows, id: \.day) { r in FreeRowView(row: r, y: y, m: m) }
                }
                .listStyle(.plain)
                .id("\(y)-\(m)")
                .transition(.push(from: JS.number(model.state["freeDir"]) < 0 ? .leading : .trailing))
                .gesture(DragGesture(minimumDistance: 20).onEnded { g in
                    // 横に払っても月を送る（浅い払いでは動かさない）
                    if abs(g.translation.width) >= 60 && abs(g.translation.width) > abs(g.translation.height) * 1.2 {
                        withAnimation(.snappy(duration: 0.26)) { model.act { $0.shiftFree(g.translation.width < 0 ? 1 : -1) } }
                    }
                })
            }
            .background(ink("bg"))
            .navigationTitle("いつ空いてる？")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("シェア") { model.act { $0.openShare() } }
                        .foregroundStyle(ink("ink-mut"))
                        .accessibilityIdentifier("free.share")
                }
            }
            .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "day" && model.state["dayFrom"] == "free" },
                                                        set: { on in if !on && model.state["screen"] == "day" { model.act { $0.set(["screen": "free", "dayNum": .null]) } } })) {
                DayScreen()
            }
        }
        .shareCovers(from: "free")
    }
}

struct FreeRowView: View {
    let row: FreeView.Row
    let y: Int, m: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(spacing: 0) {
            Button {
                model.act { e in e.haptic("light"); e.set(["ym": .object(["y": .number(Double(y)), "m": .number(Double(m))]), "screen": "day", "dayNum": .number(Double(row.day)), "swipeRow": .null, "dayFrom": "free"]) }
            } label: {
                VStack(spacing: 0) {
                    Text(row.dow).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(row.dowColor))
                    Text("\(row.day)").font(.system(size: 18)).monospacedDigit().foregroundStyle(ink.css(row.dayColor)).frame(height: 22)
                    if !row.hol.isEmpty {
                        Text(row.hol).font(.system(size: 8.5)).foregroundStyle(ink("sun")).lineLimit(1).truncationMode(.tail).frame(maxWidth: 44)
                    }
                }
                .frame(width: 38)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 3) {
                if !row.tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(Array(row.tags.enumerated()), id: \.offset) { _, t in
                            HStack(spacing: 5) {
                                FreeCapWidth(max: 130) { Text(t.text).font(.system(size: 10)).lineLimit(1).padding(.horizontal, 6).frame(height: 15) }
                                    .foregroundStyle(ink.css(t.style["color"]?.string))
                                    .background(ink.css(t.style["background"]?.string), in: RoundedRectangle(cornerRadius: 4))
                                    .strikethrough(t.style["textDecoration"] == "line-through")
                                    .opacity(t.style["opacity"]?.number ?? 1)
                                Text(t.time).font(.system(size: 10, weight: .semibold)).monospacedDigit().lineLimit(1).fixedSize()
                                    .foregroundStyle(Color(red: 0x9A / 255, green: 0xA0 / 255, blue: 0xA6 / 255))
                            }
                        }
                    }
                }
                if !row.note.isEmpty { Text(row.note).font(.system(size: 11)).foregroundStyle(ink.css(row.noteColor)) }
            }
            .padding(.horizontal, 12)
            Spacer(minLength: 0)
            Button { model.act { $0.cycleMark(row.key, row.auto) } } label: {
                Text(row.mark).font(.system(size: 17)).foregroundStyle(ink.css(row.markColor))
                    .frame(width: 30, height: 30)
                    .background(ink.css(row.markBg.isEmpty ? "transparent" : row.markBg), in: Circle())
                    .overlay { if !row.markBorder.isEmpty { Circle().strokeBorder(Color(red: 0xE0 / 255, green: 0x92 / 255, blue: 0x1C / 255), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                    .overlay { if row.manual { Circle().stroke(Color.black.opacity(0.22), lineWidth: 1.5).padding(-0.75) } }
                    .padding(3)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(.leading, 6)
            .accessibilityLabel("\(row.day)日の印 \(row.mark)")
        }
        .opacity(row.dim ? 0.5 : 1)
        .animation(.snappy(duration: 0.2), value: row.mark)
    }
}

/// 中身の幅に合わせ、max より広くはしない（Web 版の display:inline-block; max-width）
struct FreeCapWidth: Layout {
    var max: CGFloat
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let v = subviews.first else { return .zero }
        return v.sizeThatFits(ProposedViewSize(width: Swift.min(proposal.width ?? max, max), height: proposal.height))
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: bounds.origin, proposal: ProposedViewSize(width: bounds.width, height: bounds.height))
    }
}
