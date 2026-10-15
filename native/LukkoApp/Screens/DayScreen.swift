import SwiftUI
import LukkoKit

/// 日の画面（Web 版の DAY）。大きな日付・日付の帯・一覧｜時間
struct DayScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let ym = model.state["ym"] ?? .null
        let Y = JS.int(ym["y"]), M = JS.int(ym["m"])
        let d = JS.int(model.state["dayNum"])
        let v = model.core.dayView(Y, M, max(1, d), dark: model.dark)
        VStack(spacing: 0) {
            DayStrip(selected: Civil.dayNo(Y, M, max(1, d)))
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(v.head.bigDate).font(.system(size: 26, weight: .semibold)).foregroundStyle(ink.css(v.head.dateColor))
                Text(v.head.dowFull).font(.system(size: 15)).foregroundStyle(ink("ink-mut"))
                if !v.head.holiday.isEmpty { Text(v.head.holiday).font(.system(size: 13)).foregroundStyle(ink("sun")) }
                Spacer()
                Picker("表示", selection: Binding(get: { v.head.view }, set: { k in
                    model.act { e in e.haptic("light"); e.set(["settings": .object(Engine.with(e.state["settings"]?.object ?? [:], ["dayView": .string(k)]))]) }
                })) {
                    Text("一覧").tag("list")
                    Text("時間").tag("time")
                }
                .pickerStyle(.segmented)
                .frame(width: 110)
            }
            .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 4)
            if !v.head.summary.isEmpty {
                Text(v.head.summary).font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.bottom, 4)
            }
            if v.head.view == "time" {
                DayTimeView(y: Y, m: M, d: d)
            } else {
                DayList(rows: v.rows, empty: v.head.empty, d: d)
            }
        }
        .background(ink("bg"))
        .navigationTitle(v.head.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { model.act { $0.openNew(d, "day") } } label: { Image(systemName: "plus") }
                    .accessibilityLabel("予定を追加")
            }
        }
    }
}

/// 日付の帯。横に流して日を選ぶ（押すとその日へ）。予定のある日に点
struct DayStrip: View {
    let selected: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var pos: Int?

    var body: some View {
        let core = model.core
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 0) {
                ForEach((selected - 60)...(selected + 60), id: \.self) { n in
                    let c = core.dayStripCell(n, selected: selected)
                    Button {
                        guard !c.sel else { return }
                        let o = Civil.fromDayNo(n)
                        model.act { e in
                            e.haptic("light")
                            e.set(["ym": .object(["y": .number(Double(o.y)), "m": .number(Double(o.m))]), "dayNum": .number(Double(o.d)), "swipeRow": .null, "dayDir": .number(n > selected ? 1 : -1)])
                        }
                    } label: {
                        VStack(spacing: 3) {
                            Text(c.monthHead.isEmpty ? " " : c.monthHead).font(.system(size: 9, weight: .semibold)).foregroundStyle(ink("ink-mut"))
                            Text(c.dow).font(.system(size: 11)).foregroundStyle(ink.css(c.dowColor))
                            Text("\(c.date)").font(.system(size: 16, weight: c.sel ? .bold : .regular)).monospacedDigit()
                                .foregroundStyle(ink.css(c.numColor))
                                .frame(width: 34, height: 34)
                                .background { if c.sel { Circle().fill(ink("ink")) } else if c.today { Circle().strokeBorder(ink("ink"), lineWidth: 1.2) } }
                            Circle().fill(c.has ? ink("ink-faint") : .clear).frame(width: 5, height: 5)
                        }
                        .frame(width: 50)
                    }
                    .buttonStyle(.plain)
                    .id(n)
                }
            }
            .scrollTargetLayout()
        }
        .scrollPosition(id: $pos, anchor: .center)
        .frame(height: 78)
        .onAppear { pos = selected }
        .onChange(of: selected) { _, s in withAnimation(.snappy) { pos = s } }
    }
}

/// 一覧。予定のカード（左に開始／終了、種類の色の縦棒、題名・長さ・場所、右に状態の札）
struct DayList: View {
    let rows: [DayCore.Row]
    let empty: Bool
    let d: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        List {
            if empty {
                VStack(spacing: 10) {
                    Image(systemName: "calendar").font(.system(size: 34)).foregroundStyle(ink("ink-faint"))
                    Text("この日の予定はまだありません").font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                }
                .frame(maxWidth: .infinity).padding(.vertical, 40)
                .listRowBackground(Color.clear).listRowSeparator(.hidden)
            }
            ForEach(rows, id: \.key) { r in
                if let gap = r.gapBefore {
                    Text(gap).font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .listRowBackground(Color.clear).listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 2, leading: 16, bottom: 2, trailing: 16))
                }
                DayCard(row: r)
                    .contentShape(Rectangle())
                    .onTapGesture { open(r) }
                    .listRowBackground(Color.clear).listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 5, trailing: 16))
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) { model.act { e in e.haptic("light"); e.askDelete(r.key) } } label: { Label("削除", systemImage: "trash") }
                    }
                    .contextMenu {
                        Button { open(r) } label: { Label("開く", systemImage: "arrow.up.forward.app") }
                        Button { edit(r) } label: { Label("編集", systemImage: "pencil") }
                        Button(role: .destructive) { model.act { $0.askDelete(r.key) } } label: { Label("削除", systemImage: "trash") }
                    }
            }
            VStack(spacing: 10) {
                Button { model.act { $0.openNew(d, "day") } } label: {
                    Label("予定を追加", systemImage: "plus").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                Button("時間を決めずに入れる") { model.act { $0.openNew(d, "day", ["allDay": true]) } }
                    .font(.system(size: 13))
            }
            .padding(.top, 8)
            .listRowBackground(Color.clear).listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private func event(_ r: DayCore.Row) -> [String: JSONValue]? {
        (model.state["events"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == r.key }
    }
    private func open(_ r: DayCore.Row) {
        guard let ev = event(r) else { return }
        model.act { e in e.set(["swipeRow": .null]); e.openFor(ev, "day") }
    }
    private func edit(_ r: DayCore.Row) {
        guard let ev = event(r) else { return }
        model.act { $0.openEdit(ev, "day") }
    }
}

/// 予定のカード 1 枚
struct DayCard: View {
    let row: DayCore.Row
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .trailing, spacing: 2) {
                Text(row.startText).font(.system(size: 13, weight: .medium)).monospacedDigit().foregroundStyle(ink("ink"))
                if !row.endText.isEmpty { Text(row.endText).font(.system(size: 12)).monospacedDigit().foregroundStyle(ink("ink-mut")) }
            }
            .frame(width: 54, alignment: .trailing)
            // 種類の色の縦棒（まだは点線）
            Group {
                if row.dashed {
                    DashedBar().stroke(ink.css(row.accent), style: StrokeStyle(lineWidth: 4, dash: [6, 4]))
                } else {
                    RoundedRectangle(cornerRadius: 2).fill(ink.css(row.bar))
                }
            }
            .frame(width: 4)
            .frame(maxHeight: .infinity)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.titleText).font(.system(size: row.titleSize)).foregroundStyle(ink.css(row.titleColor))
                    .strikethrough(row.titleDeco == "line-through").lineLimit(1)
                let sub = [row.durText ?? "", row.place].filter { !$0.isEmpty }.joined(separator: "・")
                if !sub.isEmpty { Text(sub).font(.system(size: 12)).foregroundStyle(ink("ink-mut")).lineLimit(1) }
            }
            Spacer(minLength: 0)
            Text(row.statusWord).font(.system(size: 11))
                .foregroundStyle(ink.css(row.chip["color"]?.string))
                .padding(.horizontal, 8).padding(.vertical, 2)
                .background(ink.css(row.chip["background"]?.string), in: Capsule())
                .overlay {
                    if let b = row.chip["border"]?.string {
                        Capsule().strokeBorder(ink.css(String(b.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
                    }
                }
                .lineLimit(1).fixedSize()
        }
        .padding(14)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
        .overlay {
            if row.dashed {
                RoundedRectangle(cornerRadius: 16).strokeBorder(ink.css(String(row.cardBorder.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
            } else {
                RoundedRectangle(cornerRadius: 16).strokeBorder(ink("line"), lineWidth: 1)
            }
        }
    }
}

struct DashedBar: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        return p
    }
}

/// 時間（目盛りの上に箱）。何もない時間を押すと、その時刻から予定を作る
struct DayTimeView: View {
    let y: Int, m: Int, d: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let core = model.core
        let hide = JS.truthy(model.state["settings"]?["hideCanceled"])
        let pool = (model.state["events"]?.array ?? []).compactMap { $0.object }.filter { !(hide && $0["status"] == "nakunatta") }
        let allDay = core.timeGridAllDay(pool, y, m, d, dark: model.dark)
        let boxes = core.timeGridBoxes(pool, over: [], y, m, d, dark: model.dark)
        let H = CGFloat(DayCore.hourH)
        let t = model.state["today"] ?? .null
        let isToday = Civil.dayNo(y, m, d) == Civil.dayNo(JS.int(t["y"]), JS.int(t["m"]), JS.int(t["d"]))
        VStack(spacing: 0) {
            if !allDay.pills.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(allDay.pills.enumerated()), id: \.offset) { _, p in
                        Text(p.title).font(.system(size: 10)).lineLimit(1)
                            .foregroundStyle(ink.css(p.style["color"]?.string))
                            .padding(.horizontal, 4).frame(maxWidth: .infinity, alignment: .leading).frame(height: 17)
                            .background(ink.css(p.style["background"]?.string), in: RoundedRectangle(cornerRadius: 4))
                            .onTapGesture { model.act { $0.openFor(p.ev, "day") } }
                    }
                    if allDay.more > 0 { Text("+\(allDay.more)件").font(.system(size: 10)).foregroundStyle(ink("ink-mut")) }
                }
                .padding(.leading, 44).padding(.trailing, 8).padding(.vertical, 4)
            }
            ScrollViewReader { proxy in
                ScrollView {
                    ZStack(alignment: .topLeading) {
                        VStack(spacing: 0) {
                            ForEach(0..<24, id: \.self) { h in
                                HStack(alignment: .top, spacing: 4) {
                                    Text(h == 0 ? "" : "\(h)").font(.system(size: 10)).foregroundStyle(ink("ink-mut")).frame(width: 36, alignment: .trailing).offset(y: -6)
                                    Rectangle().fill(ink("line")).frame(height: 1)
                                }
                                .frame(height: H, alignment: .top)
                                .id(h)
                            }
                        }
                        GeometryReader { geo in
                            let w = geo.size.width - 44
                            Color.clear.contentShape(Rectangle())
                                .onTapGesture(coordinateSpace: .local) { pt in
                                    let min = Int((pt.y / (H * 24) * 48).rounded(.down)) * 30
                                    model.act { $0.openNew(d, "day", ["y": .number(Double(y)), "m": .number(Double(m)), "start": .number(Double(min))]) }
                                }
                            ForEach(boxes, id: \.key) { b in
                                let x = 44 + w * CGFloat(b.col) / CGFloat(max(1, b.cols)) + 1
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(b.title).font(.system(size: 10.5, weight: .medium)).lineLimit(2)
                                        .strikethrough(b.style["textDecoration"] == "line-through")
                                    if !b.time.isEmpty { Text(b.time).font(.system(size: 10)).opacity(0.8) }
                                }
                                .foregroundStyle(ink.css(b.style["color"]?.string))
                                .padding(.horizontal, 4).padding(.vertical, 2)
                                .frame(width: max(0, w / CGFloat(max(1, b.cols)) - 2), height: CGFloat(b.style["height"]?.number ?? 16), alignment: .topLeading)
                                .background(ink.css(b.style["background"]?.string), in: RoundedRectangle(cornerRadius: 5))
                                .overlay {
                                    if let border = b.style["border"]?.string {
                                        RoundedRectangle(cornerRadius: 5).strokeBorder(ink.css(String(border.split(separator: " ").last ?? "")),
                                                                                         style: StrokeStyle(lineWidth: 1.5, dash: border.contains("dashed") ? [4, 3] : []))
                                    }
                                }
                                .offset(x: x, y: CGFloat(b.style["top"]?.number ?? 0))
                                .onTapGesture { model.act { $0.openFor(b.ev, "day") } }
                            }
                            if isToday {
                                let now = JSDate.local(AppModel.nowMs(), .current)
                                Rectangle().fill(Color.red).frame(width: w, height: 1.5)
                                    .offset(x: 44, y: CGFloat(now.h * 60 + now.min) / 60 * H)
                                    .allowsHitTesting(false)
                            }
                        }
                    }
                    .frame(height: H * 24)
                }
                .onAppear {
                    var first = 8 * 60.0
                    for b in boxes { first = min(first, b.a) }
                    proxy.scrollTo(max(0, Int(first / 60)), anchor: .top)
                }
            }
        }
    }
}
