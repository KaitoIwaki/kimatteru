import SwiftUI
import LukkoKit

/// 月表示（Web 版の MONTH）。見出し・細い段・曜日・月のマス（横に払って月を送る）。
/// 週表示（月｜週の「週」）のときは、マスの代わりに週の帯（WeekStripView）
struct MonthScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let h = model.engine.monthHead()
        NavigationStack {
            VStack(spacing: 0) {
                MonthSubBar(h: h)
                if h.calView == "week" {
                    WeekStripView()
                } else {
                    WeekdayHeader(h: h)
                    MonthPager()
                }
            }
            .background(ink("bg"))
            // シフト入力のパレットか、給料バー（下に浮かせる。マスの最終週が隠れないよう、そのぶん上に詰める）
            .safeAreaInset(edge: .bottom, spacing: 0) { MonthBottomBar() }
            // 予定がまだ 0 件のときの案内（浮かせて出す）
            .overlay(alignment: .top) { HintFirstRun() }
            .toolbar { MonthToolbar(h: h) }
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: dayShown) { DayScreen() }
            .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "notices" },
                                                        set: { on in if !on && model.state["screen"] == "notices" { model.act { $0.set(["screen": "month", "noticeOpen": .null]) } } })) { NoticesScreen() }
            // 一覧（その上に詳細・新しい予定が重なっているあいだも残す）
            .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "list" || (["detail", "new"].contains(model.state["screen"]?.string ?? "") && model.state["returnTo"] == "list") },
                                                        set: { on in if !on && model.state["screen"] == "list" { model.act { $0.set(["screen": "month"]) } } })) { ListScreen() }
            .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "detail" && !["day", "list"].contains(model.state["returnTo"]?.string ?? "") },
                                                        set: { on in if !on && model.state["screen"] == "detail" { model.act { $0.detailBack() } } })) { DetailScreen() }
            // 年月えらび（月名を押す）
            .sheet(isPresented: Binding(get: { JS.truthy(model.state["ymSheet"]) },
                                        set: { on in if !on && JS.truthy(model.state["ymSheet"]) { model.act { $0.ymSheetClose() } } })) {
                YMSheet().environment(\.ink, ink)
            }
        }
    }

    /// 日の画面（screen が "day" のとき）。戻ると、来たところ（月か空き状況）へ
    private var dayShown: Binding<Bool> {
        // 日の画面の上に、予定の画面（新しい予定・詳細）が重なっているあいだも、日の画面は残す
        Binding(get: { JS.truthy(model.state["dayNum"]) && (model.state["screen"] == "day" || model.state["returnTo"] == "day") }, set: { on in
            if !on && model.state["screen"] == "day" {
                let back: JSONValue = model.state["dayFrom"] == "free" ? .string("free") : .string("month")
                model.act { $0.set(["screen": back, "dayNum": .null]) }
            }
        })
    }
}

/// 見出し：‹ 10月 2026 ›・今日・探す・一覧・お知らせ。週表示のときは ‹ › が 7 日ずつ
struct MonthToolbar: ToolbarContent {
    let h: MonthHead
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            HStack(spacing: 2) {
                Button { model.act { $0.headPrev() } } label: { Image(systemName: "chevron.left").frame(width: 28, height: 38) }
                    .accessibilityLabel(h.calView == "week" ? "前の週" : "前の月")
                Button { model.act { $0.tapMonthHead() } } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text("\(h.monthLabel)月").font(.system(size: 26, weight: .light)).tracking(-0.5).foregroundStyle(ink("ink"))
                        Text(h.year).font(.system(size: 14, weight: .medium)).foregroundStyle(ink("ink-mut"))
                    }
                    .lineLimit(1)
                }
                .accessibilityLabel("年と月をえらぶ")
                Button { model.act { $0.headNext() } } label: { Image(systemName: "chevron.right").frame(width: 28, height: 38) }
                    .accessibilityLabel(h.calView == "week" ? "次の週" : "次の月")
            }
            .fixedSize()
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            if h.todayBtnShown {
                Button("今日") { model.act { $0.headToday() } }
            }
            Button { model.act { e in e.haptic("light"); e.set(["screen": "list", "listTab": "search", "returnTo": "month"]) } } label: { Image(systemName: "magnifyingglass") }
                .accessibilityLabel("予定を探す")
            Button { model.act { e in e.haptic("light"); e.set(["screen": "list", "listTab": "upcoming", "returnTo": "month"]) } } label: { Image(systemName: "list.bullet") }
                .accessibilityLabel("これからの予定の一覧")
            Button { model.act { e in e.haptic("light"); e.set(["screen": "notices"]) } } label: {
                Image(systemName: "bell")
                    .overlay(alignment: .topTrailing) {
                        if h.bellCount > 0 {
                            Text(h.bellBadge).font(.system(size: 10, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                                .padding(.horizontal, 4).frame(minWidth: 16, minHeight: 16)
                                .background(Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255), in: Capsule())
                                .overlay(Capsule().strokeBorder(ink("bg"), lineWidth: 1.5))
                                .offset(x: 8, y: -6)
                        }
                    }
            }
            .accessibilityLabel("お知らせ")
        }
    }
}

/// 見出しの下の細い段：月｜週・まだ N・日にち未定・シフト入力・給料
struct MonthSubBar: View {
    let h: MonthHead
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(spacing: 8) {
            Picker("表示", selection: Binding(get: { h.calView }, set: { k in model.act { $0.setCalView(k) } })) {
                Text("月").tag("month")
                Text("週").tag("week")
            }
            .pickerStyle(.segmented)
            .frame(width: 84)
            .accessibilityIdentifier("month.viewSeg")
            if h.undecidedCount > 0 {
                Button { model.act { e in e.haptic("light"); e.set(["screen": "list", "listTab": "undecided", "returnTo": "month"]) } } label: {
                    HStack(spacing: 5) { Text("まだ \(h.undecidedCount)"); Text("›").foregroundStyle(ink("ink-faint")) }
                        .font(.system(size: 12)).foregroundStyle(ink("ink-soft"))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .overlay(Capsule().strokeBorder(ink("ink-faint"), style: StrokeStyle(lineWidth: 1.3, dash: [3, 2])))
                        .fixedSize()
                }
                .buttonStyle(.plain)
            }
            if h.shelfCount > 0 {
                Button { model.act { e in e.haptic("light"); e.set(["screen": "list", "listTab": "undecided", "returnTo": "month"]) } } label: {
                    Text(h.shelfLabel).font(.system(size: 12)).foregroundStyle(ink("ink-soft")).lineLimit(1).truncationMode(.tail)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(ink("bg2"), in: Capsule())
                }
                .buttonStyle(.plain)
                // 狭いときは、この札だけ詰める（…で切る）
                .layoutPriority(-1)
            }
            Spacer(minLength: 0)
            if h.stampChipShown {
                let on = JS.truthy(model.state["stamp"])
                Button { model.act { $0.toggleStamp() } } label: {
                    Text("シフト入力").font(.system(size: 12))
                        .foregroundStyle(on ? ink("card") : ink("ink-soft"))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(on ? ink("ink") : .clear, in: Capsule())
                        .overlay(Capsule().strokeBorder(on ? .clear : ink("line")))
                        .fixedSize()
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("month.stampChip")
            }
            if h.wageToggleShown {
                // 給料のスイッチ（Web 版と同じ小さめの 44×26。段に全部が収まるように）
                let on = JS.truthy(model.state["wageOn"])
                Button { model.act { $0.toggleWage() } } label: {
                    HStack(spacing: 7) {
                        Text("給料").font(.system(size: 12)).foregroundStyle(on ? ink("ink") : ink("ink-mut"))
                        Capsule().fill(on ? Color(red: 0x7F / 255, green: 0xAE / 255, blue: 0x85 / 255) : ink("line"))
                            .frame(width: 44, height: 26)
                            .overlay(alignment: .leading) {
                                Circle().fill(ink("card")).frame(width: 22, height: 22)
                                    .shadow(color: .black.opacity(0.25), radius: 1, y: 1)
                                    .offset(x: on ? 20 : 2)
                            }
                            .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.28), value: on)
                    }
                    .fixedSize()
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("給料")
                .accessibilityValue(on ? "オン" : "オフ")
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("month.wageToggle")
            }
        }
        .padding(.leading, 14).padding(.trailing, 12).padding(.bottom, 8).padding(.top, 2)
        .frame(minHeight: 30)
    }
}

/// 曜日の見出し（週のはじまりに合わせて並べる。日曜は赤、土曜は青）
struct WeekdayHeader: View {
    let h: MonthHead
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(h.weekdays.enumerated()), id: \.offset) { _, w in
                Text(w.label).font(.system(size: 11, weight: .semibold)).foregroundStyle(ink.css(w.color)).frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 6).padding(.bottom, 5)
        .overlay(alignment: .bottom) { Rectangle().fill(ink("line")).frame(height: 1) }
    }
}

/// 月のマス。横に払うと隣の月へ（iPhone 標準のページ送り。指についてきて、離すと隣の月に収まるか戻る）
struct MonthPager: View {
    @Environment(AppModel.self) private var model
    /// 何か月目か（2000 年 1 月からの通し番号）
    @State private var page = 0
    static func index(_ y: Int, _ m: Int) -> Int { (y - 2000) * 12 + m }
    static func ym(_ i: Int) -> (y: Int, m: Int) { (2000 + Int((Double(i) / 12).rounded(.down)), ((i % 12) + 12) % 12) }

    var body: some View {
        let ym = model.state["ym"] ?? .null
        let cur = Self.index(JS.int(ym["y"]), JS.int(ym["m"]))
        TabView(selection: $page) {
            ForEach((cur - 2)...(cur + 2), id: \.self) { i in
                MonthGrid(y: Self.ym(i).y, m: Self.ym(i).m)
                    .tag(i)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .onAppear { page = cur }
        .onChange(of: cur) { _, c in if page != c { page = c } }
        .onChange(of: page) { _, p in
            guard p != cur else { return }
            model.act { e in
                // 払ったときに日付が変わっていないか確かめる（Web 版の _checkToday）
                e.checkToday()
                let n = Self.ym(p)
                e.set(["ym": JSONValue.object(["y": .number(Double(n.y)), "m": .number(Double(n.m))]), "dayNum": .null])
            }
        }
    }
}

/// 1 か月ぶんのマス。週ごとに、日付の段と帯の段を重ねる
struct MonthGrid: View {
    let y: Int, m: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        GeometryReader { geo in
            let core = model.core
            let ws = JS.int(core.state["settings"]?["weekStart"])
            let first = ((Civil.weekday(y, m, 1) - ws) % 7 + 7) % 7
            let weekCount = Int((Double(first + Civil.daysInMonth(y, m)) / 7).rounded(.up))
            let es = core.evScale()
            let barH = CGFloat(JS.round(MonthCore.barH * es))
            let laneH = barH + 2
            let rowH = geo.size.height / CGFloat(max(1, weekCount))
            // 入るぶんだけ積む（2〜7 段）。入らない予定は「+N件」
            let lanes = max(2, min(7, Int(((rowH - 22 - 14) / laneH).rounded(.down))))
            let wageOn = JS.truthy(model.state["wageOn"]) && model.engine.wageFeatureOn()
            let monthA = Civil.dayNo(y, m, 1)
            let weeks = core.buildWeeks(y, m, lanes: lanes, overlay: model.overlayFor(monthA, monthA + Civil.daysInMonth(y, m)), wageOn: wageOn, dark: model.dark)
            let mo = model.state["morph"].flatMap { JS.truthy($0) ? $0 : nil }
            let morph: (id: JSONValue, phase: String)? = mo.map { (id: $0["id"] ?? .null, phase: JS.string($0["phase"])) }
            VStack(spacing: 0) {
                ForEach(Array(weeks.enumerated()), id: \.offset) { w, week in
                    WeekRow(y: y, m: m, week: week, colW: geo.size.width / 7, laneH: laneH, barH: barH, scale: es, morph: morph)
                        .frame(height: rowH)
                        .overlay(alignment: .top) { if w > 0 { Rectangle().fill(ink("line")).frame(height: 1) } }
                }
            }
        }
        .background(ink("card"))
    }
}

/// 1 週。地（押せるマス）・日付・帯・「+N件」
struct WeekRow: View {
    let y: Int, m: Int
    let week: MonthCore.Week
    let colW: CGFloat, laneH: CGFloat, barH: CGFloat, scale: Double
    var morph: (id: JSONValue, phase: String)? = nil
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        ZStack(alignment: .topLeading) {
            // 地とタップ領域。帯はこの上に載る（帯は押せない。マスのどこを押してもその日が開く）
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    let sl = week.slots[i]
                    Rectangle().fill(ink.css(sl.bg))
                        .overlay { if sl.today { TodayFlash(at: model.state["flashToday"]?.number ?? 0) } }
                        .overlay(alignment: .trailing) { if i < 6 { Rectangle().fill(ink("line-faint")).frame(width: 1) } }
                        .contentShape(Rectangle())
                        .onTapGesture { tapDay(sl) }
                        .accessibilityElement()
                        .accessibilityLabel(sl.blank ? "" : "\(sl.day)日")
                        .accessibilityIdentifier(sl.blank ? "" : "month.day.\(sl.day)")
                        .accessibilityAddTraits(sl.blank ? [] : .isButton)
                }
            }
            // 日付
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { i in
                    let sl = week.slots[i]
                    HStack(spacing: 0) {
                        if sl.today {
                            Text("\(sl.day)").font(.system(size: 11, weight: .bold)).monospacedDigit()
                                .foregroundStyle(ink.css(sl.color))
                                .padding(.horizontal, 3).frame(minWidth: 18, minHeight: 18)
                                .background(ink.css(sl.todayBg), in: Capsule())
                        } else {
                            Text("\(sl.day)").font(.system(size: 11, weight: sl.weight >= 600 ? .semibold : .medium)).monospacedDigit()
                                .foregroundStyle(ink.css(sl.color))
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.leading, sl.today ? 2 : 4)
                    .frame(width: colW, height: 22, alignment: .leading)
                }
            }
            .allowsHitTesting(false)
            // 帯
            ForEach(week.bars, id: \.key) { b in
                let L = margin(b, "marginLeft") > 0, R = margin(b, "marginRight") > 0
                Group {
                    if let mo = morph, mo.id == b.id, let ev = event(b.id) {
                        CelebrateMorphBar(m: model.core.morphBar(ev, phase: mo.phase, startsHere: L, endsHere: R, dark: model.dark),
                                          height: barH, scale: scale, left: L, right: R)
                    } else {
                        BarView(bar: b, height: barH, scale: scale)
                    }
                }
                .frame(width: max(0, colW * CGFloat(b.span) - margin(b, "marginLeft") - margin(b, "marginRight")), height: barH)
                .offset(x: colW * CGFloat(b.c0) + margin(b, "marginLeft"), y: 22 + CGFloat(b.lane) * laneH)
                .allowsHitTesting(false)
            }
            // 入らなかった数
            ForEach(week.more, id: \.col) { mo in
                Text("+\(mo.n)件").font(.system(size: 10, weight: .medium)).foregroundStyle(ink("ink-mut"))
                    .lineLimit(1)
                    .frame(width: colW - 4, alignment: .leading)
                    .offset(x: colW * CGFloat(mo.col) + 4, y: 22 + CGFloat(week.lanes) * laneH)
                    .allowsHitTesting(false)
            }
        }
        .clipped()
    }

    private func margin(_ b: MonthCore.Bar, _ k: String) -> CGFloat { CGFloat(b.style[k]?.number ?? 0) }
    private func event(_ id: JSONValue) -> [String: JSONValue]? {
        (model.state["events"]?.array ?? []).lazy.compactMap { $0.object }.first { $0["id"] == id }
    }

    private func tapDay(_ sl: MonthCore.Slot) {
        guard !sl.blank else { return }
        model.act { e in
            // シフト入力のあいだは、押した日に型を置く（その日の一覧は開かない）
            if JS.truthy(e.state["stamp"]) { e.stampDay(y, m, sl.day) }
            else { e.set(["ym": JSONValue.object(["y": .number(Double(y)), "m": .number(Double(m))])]); e.openDay(sl.day) }
        }
    }
}

/// 今日へ戻ったとき、今日のマスを一度だけ光らせる（1.2 秒。押してから 1.5 秒以内のときだけ）
struct TodayFlash: View {
    let at: Double
    @State private var on = false
    var body: some View {
        Rectangle().fill(Color(red: 29 / 255, green: 158 / 255, blue: 117 / 255).opacity(on ? 0.28 : 0))
            .allowsHitTesting(false)
            .onAppear { fire() }
            .onChange(of: at) { _, _ in fire() }
    }
    private func fire() {
        guard at > 0, AppModel.nowMs() - at < 1500 else { return }
        on = true
        DispatchQueue.main.async { withAnimation(.easeOut(duration: 1.2)) { on = false } }
    }
}

/// 帯 1 本。決まった＝塗り、まだ＝点線、記録＝塗り＋✓、無くなった＝取り消し線
struct BarView: View {
    let bar: MonthCore.Bar
    let height: CGFloat
    let scale: Double
    @Environment(\.ink) private var ink

    var body: some View {
        let st = bar.style
        let L = (st["marginLeft"]?.number ?? 0) > 0, R = (st["marginRight"]?.number ?? 0) > 0
        let r: CGFloat = 3
        let shape = UnevenRoundedRectangle(topLeadingRadius: L ? r : 0, bottomLeadingRadius: L ? r : 0, bottomTrailingRadius: R ? r : 0, topTrailingRadius: R ? r : 0)
        let dashed = st["border"]?.string?.contains("dashed") == true
        HStack(spacing: 0) {
            if !bar.mark.isEmpty {
                Text(bar.mark).font(.system(size: 9 * scale, weight: .heavy)).opacity(0.75).padding(.trailing, 2).fixedSize()
            }
            Text(bar.text).font(.system(size: 10 * scale, weight: .medium)).tracking(-0.4)
                .strikethrough(st["textDecoration"] == "line-through")
                .lineLimit(1).truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .foregroundStyle(ink.css(st["color"]?.string))
        .padding(.horizontal, 3)
        .frame(height: height)
        .background(shape.fill(ink.css(st["background"]?.string)))
        .overlay {
            if dashed, let border = st["border"]?.string {
                let color = String(border.split(separator: " ", maxSplits: 2).last ?? "")
                OpenSidesRect(left: L, right: R, radius: r)
                    .stroke(ink.css(color), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
            }
            if let left = st["borderLeft"]?.string, left.hasPrefix("2px") {
                HStack { Rectangle().fill(ink("ink-faint")).frame(width: 2); Spacer() }
            }
            // 夜勤の「明け」は下線だけ
            if let bottom = st["borderBottom"]?.string, bottom.hasPrefix("2px") {
                VStack { Spacer(); Rectangle().fill(ink.css(String(bottom.split(separator: " ", maxSplits: 2).last ?? ""))).frame(height: 2) }
            }
        }
        .clipShape(shape)
        .opacity(st["opacity"]?.number ?? 1)
    }
}

/// 点線の枠。続きがある側（左右）の辺は描かない
struct OpenSidesRect: Shape {
    let left: Bool, right: Bool, radius: CGFloat
    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: 0.75, dy: 0.75)
        var p = Path()
        p.move(to: CGPoint(x: left ? r.minX + radius : r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: right ? r.maxX - radius : r.maxX, y: r.minY))
        if right {
            p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.minY), tangent2End: CGPoint(x: r.maxX, y: r.minY + radius), radius: radius)
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - radius))
            p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.maxY), tangent2End: CGPoint(x: r.maxX - radius, y: r.maxY), radius: radius)
        } else {
            p.move(to: CGPoint(x: r.maxX, y: r.maxY))
        }
        p.addLine(to: CGPoint(x: left ? r.minX + radius : r.minX, y: r.maxY))
        if left {
            p.addArc(tangent1End: CGPoint(x: r.minX, y: r.maxY), tangent2End: CGPoint(x: r.minX, y: r.maxY - radius), radius: radius)
            p.addLine(to: CGPoint(x: r.minX, y: r.minY + radius))
            p.addArc(tangent1End: CGPoint(x: r.minX, y: r.minY), tangent2End: CGPoint(x: r.minX + radius, y: r.minY), radius: radius)
        }
        return p
    }
}
