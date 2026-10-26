import SwiftUI
import LukkoKit

/// 月を縦につなげて動かす表示（設定の「月を縦にスクロール」）。
/// 週を 1 行ずつ縦に並べ、指で動かした分だけずれる。10/31 と 11/1 は同じ行に入り、月のはじめの日に「11月」と添える。
/// 月の境目は、段のように太い線で囲む。1 画面に見えるのは 5 週ほど。
/// 見出しの月（state.ym）は、画面のまんなかあたりの週で決め、止まって少したってから 1 回だけ書き換える
struct MonthScroller: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    /// 1 画面に見せる週の数
    static let rowsShown: CGFloat = 5
    /// 並べる週の数（1970 年 1 月〜2119 年 12 月をおおう）
    static let count = (Civil.dayNo(2120, 0, 1) - Civil.dayNo(1970, 0, 1)) / 7 + 2
    /// 0 番目の週の、いちばん左の日
    static func base(_ ws: Int) -> Int { MonthCore.weekStartOf(Civil.dayNo(1970, 0, 1), weekStart: ws) }
    /// その月の 1 日が入っている週の番号
    static func weekOf(_ monthIndex: Int, _ base: Int) -> Int {
        let ym = MonthPager.ym(monthIndex)
        return min(max(0, (Civil.dayNo(ym.y, ym.m, 1) - base) / 7), count - 1)
    }
    /// いちばん上が top 番目の週のときの、見出しの月（上から 3 週目の、まんなかの日の月）
    static func monthAt(_ top: Int, _ base: Int) -> Int {
        let c = Civil.fromDayNo(base + (top + 2) * 7 + 3)
        return MonthPager.clamp(MonthPager.index(c.y, c.m))
    }

    /// いちばん上に見えている週
    @State private var pos: Int?
    /// 止まってから state.ym へ書くまでの待ち
    @State private var commit: Task<Void, Never>?
    /// こちらで書いた月（動かして止まった・日を押した）。この月へは送り直さない（見ている所が飛ばないように）
    @State private var selfSet: Int?

    var body: some View {
        let ws = JS.int(model.state["settings"]?["weekStart"])
        let base = Self.base(ws)
        let cur = curMonth
        GeometryReader { geo in
            let rowH = (geo.size.height / Self.rowsShown).rounded(.down)
            ScrollView(.vertical) {
                LazyVStack(spacing: 0) {
                    ForEach(0..<Self.count, id: \.self) { i in
                        ScrollWeekRow(start: base + i * 7, rowH: rowH, colW: geo.size.width / 7, cur: MonthPager.ym(cur), onTap: tap)
                            .frame(height: rowH)
                            .id(i)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollIndicators(.hidden)
            .scrollPosition(id: $pos, anchor: .top)
        }
        .background(ink("card"))
        // はじめて出たときだけ、その月の 1 日の週へ（日の画面から戻ったときは、見ていた所のまま）
        .onAppear { if pos == nil { pos = Self.weekOf(cur, base) } }
        // ‹ › ・今日・年月えらびで月が変わった：その月の 1 日の週を上に
        .onChange(of: cur) { old, c in
            if selfSet == c { selfSet = nil; return }
            selfSet = nil
            commit?.cancel()
            let to = Self.weekOf(c, base)
            guard pos != to else { return }
            if abs(c - old) <= 2 { withAnimation(.snappy(duration: 0.3)) { pos = to } } else { pos = to }
        }
        // 週のはじまりの設定が変わった：同じ月の 1 日の週へ
        .onChange(of: ws) { _, _ in pos = Self.weekOf(curMonth, Self.base(ws)) }
        // 動かした：止まって 0.15 秒たったら、見出しの月を書き換える
        .onChange(of: pos) { _, p in
            commit?.cancel()
            guard let p else { return }
            commit = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                guard !Task.isCancelled, pos == p else { return }
                syncHead(p, base)
            }
        }
        // 日の画面から戻った：押した日の月に変わっているので、見えている月に合わせ直す
        .onChange(of: JS.truthy(model.state["dayNum"])) { _, on in
            if !on, let p = pos { syncHead(p, base) }
        }
    }

    private var curMonth: Int {
        let ym = model.state["ym"] ?? .null
        return MonthPager.clamp(MonthPager.index(JS.int(ym["y"]), JS.int(ym["m"])))
    }

    private func syncHead(_ top: Int, _ base: Int) {
        let want = Self.monthAt(top, base)
        guard want != curMonth, model.state["screen"] == "month" else { return }
        selfSet = want
        model.act { e in
            e.checkToday()
            let n = MonthPager.ym(want)
            e.set(["ym": JSONValue.object(["y": .number(Double(n.y)), "m": .number(Double(n.m))]), "dayNum": .null])
        }
    }

    /// 日を押した：その日の月にして日の画面を開く（シフト入力のあいだは型を置く）
    private func tap(_ y: Int, _ m: Int, _ d: Int) {
        model.act { e in
            if JS.truthy(e.state["stamp"]) { e.stampDay(y, m, d); return }
            let idx = MonthPager.index(y, m)
            if idx != curMonth { selfSet = idx }
            e.set(["ym": JSONValue.object(["y": .number(Double(y)), "m": .number(Double(m))])])
            e.openDay(d)
        }
    }
}

/// 縦の表示の 1 週。マスと帯は横の月表示と同じ WeekRow で描き、月の境目の太い線を重ねる
struct ScrollWeekRow: View {
    let start: Int, rowH: CGFloat, colW: CGFloat
    let cur: (y: Int, m: Int)
    let onTap: (Int, Int, Int) -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let es = model.evScale
        let barH = CGFloat(JS.round(MonthCore.barH * es))
        let laneH = barH + 2
        // 入るぶんだけ積む（2〜7 段）。入らない予定は「+N件」
        let lanes = max(2, min(7, Int(((rowH - 22 - 14) / laneH).rounded(.down))))
        let wageOn = JS.truthy(model.state["wageOn"]) && model.engine.wageFeatureOn()
        let sw = model.core.buildScrollWeek(start, lanes: lanes, overlay: model.overlayFor(start, start + 7), wageOn: wageOn, dark: model.dark)
        let mo = model.state["morph"].flatMap { JS.truthy($0) ? $0 : nil }
        let morph: (id: JSONValue, phase: String)? = mo.map { (id: $0["id"] ?? .null, phase: JS.string($0["phase"])) }
        WeekRow(y: cur.y, m: cur.m, week: sw.week, colW: colW, laneH: laneH, barH: barH, scale: es, morph: morph,
                scroll: .init(days: sw.days, cur: cur, onTap: onTap))
            .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
            .overlay(alignment: .topLeading) { edges(sw.days) }
    }

    /// 月の境目：上の段が前の月のマス（1〜7 日）は上に、左が前の月のマス（1 日）は左に、太い線
    private func edges(_ days: [MonthCore.DayRef]) -> some View {
        let c = ink("ink-faint")
        return ZStack(alignment: .topLeading) {
            ForEach(0..<7, id: \.self) { i in
                let d = days[i].d
                if d <= 7 {
                    Rectangle().fill(c).frame(width: colW, height: 2).offset(x: colW * CGFloat(i))
                }
                if d == 1 && i > 0 {
                    Rectangle().fill(c).frame(width: 2, height: rowH).offset(x: colW * CGFloat(i) - 1)
                }
            }
        }
        .allowsHitTesting(false)
    }
}
