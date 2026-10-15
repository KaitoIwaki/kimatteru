import SwiftUI
import LukkoKit

/// いつ空いてる？（Web 版の screen='free'）。1 日 1 行、右の印を押すと ○→△→× と回す
struct FreeScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let fy = model.state["freeYM"] ?? .null
        let y = JS.int(fy["y"]), m = JS.int(fy["m"])
        let v = model.core.freeView(y, m, dark: model.dark)
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    Button { model.act { $0.shiftFree(-1) } } label: { Image(systemName: "chevron.left") }.accessibilityLabel("前の月")
                    Text("\(v.monthLabel)月").font(.title3.weight(.semibold)).monospacedDigit().frame(minWidth: 56)
                    Button { model.act { $0.shiftFree(1) } } label: { Image(systemName: "chevron.right") }.accessibilityLabel("次の月")
                    Spacer()
                    HStack(spacing: 10) {
                        Text("○\(v.cO)").foregroundStyle(Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255))
                        Text("△\(v.cA)").foregroundStyle(Color(red: 0xB9 / 255, green: 0x77 / 255, blue: 0x0F / 255))
                        Text("×\(v.cX)").foregroundStyle(ink("ink-faint"))
                    }
                    .font(.subheadline.monospacedDigit())
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
                List {
                    ForEach(v.rows, id: \.day) { r in FreeRowView(row: r, y: y, m: m) }
                }
                .listStyle(.plain)
                .id("\(y)-\(m)")
                .transition(.push(from: JS.number(model.state["freeDir"]) < 0 ? .leading : .trailing))
                .gesture(DragGesture(minimumDistance: 20).onEnded { g in
                    // 横に払っても月を送る（浅い払いでは動かさない）
                    if abs(g.translation.width) >= 60 && abs(g.translation.width) > abs(g.translation.height) * 1.2 {
                        withAnimation(.snappy) { model.act { $0.shiftFree(g.translation.width < 0 ? 1 : -1) } }
                    }
                })
            }
            .background(ink("bg"))
            .navigationTitle("いつ空いてる？")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("シェア") { model.act { e in e.haptic("light"); e.set(["screen": "share", "shareToast": false, "cardFrom": "free"]) } }
                }
            }
            .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "day" && model.state["dayFrom"] == "free" },
                                                        set: { on in if !on && model.state["screen"] == "day" { model.act { $0.set(["screen": "free", "dayNum": .null]) } } })) {
                DayScreen()
            }
        }
    }
}

struct FreeRowView: View {
    let row: FreeView.Row
    let y: Int, m: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(spacing: 10) {
            Button {
                model.act { e in e.haptic("light"); e.set(["ym": .object(["y": .number(Double(y)), "m": .number(Double(m))]), "screen": "day", "dayNum": .number(Double(row.day)), "swipeRow": .null, "dayFrom": "free"]) }
            } label: {
                VStack(spacing: 0) {
                    Text(row.dow).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(row.dowColor))
                    Text("\(row.day)").font(.system(size: 18)).monospacedDigit().foregroundStyle(ink.css(row.dayColor))
                }
                .frame(width: 38)
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 3) {
                if !row.hol.isEmpty { Text(row.hol).font(.caption2).foregroundStyle(ink("sun")) }
                ForEach(Array(row.tags.enumerated()), id: \.offset) { _, t in
                    HStack(spacing: 6) {
                        Text(t.text).font(.system(size: 10)).lineLimit(1).padding(.horizontal, 6).frame(height: 15)
                            .foregroundStyle(ink.css(t.style["color"]?.string))
                            .background(ink.css(t.style["background"]?.string), in: RoundedRectangle(cornerRadius: 4))
                            .strikethrough(t.style["textDecoration"] == "line-through")
                            .opacity(t.style["opacity"]?.number ?? 1)
                        Text(t.time).font(.system(size: 10, weight: .semibold)).monospacedDigit().foregroundStyle(Color(red: 0x9A / 255, green: 0xA0 / 255, blue: 0xA6 / 255))
                    }
                }
                if !row.note.isEmpty { Text(row.note).font(.system(size: 11)).foregroundStyle(ink.css(row.noteColor)) }
            }
            Spacer(minLength: 0)
            Button { model.act { $0.cycleMark(row.key, row.auto) } } label: {
                Text(row.mark).font(.system(size: 17)).foregroundStyle(ink.css(row.markColor))
                    .frame(width: 30, height: 30)
                    .background(ink.css(row.markBg.isEmpty ? "transparent" : row.markBg), in: Circle())
                    .overlay { if !row.markBorder.isEmpty { Circle().strokeBorder(Color(red: 0xE0 / 255, green: 0x92 / 255, blue: 0x1C / 255), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                    .overlay { if row.manual { Circle().strokeBorder(Color.black.opacity(0.22), lineWidth: 1.5) } }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.day)日の印 \(row.mark)")
        }
        .opacity(row.dim ? 0.5 : 1)
    }
}
