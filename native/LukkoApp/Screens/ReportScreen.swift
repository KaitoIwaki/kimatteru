import SwiftUI
import LukkoKit

/// まとめ（Web 版の screen='report'）
struct ReportScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        // engine は見張っていないので、state を読んで「中身が変わったら描き直す」ようにする（読まないと、押しても画面が変わらない）
        let _ = model.state
        let v = model.engine.reportView()
        NavigationStack {
            VStack(spacing: 0) {
                // 月｜年 の切り替えは一覧の外に置く（一覧の行に入れると、中身が入れ替わるときに選んだほうが戻ることがある）
                if !v.empty {
                    // Web 版の repSeg と同じ形（地の上に、選んだほうだけカードの色）
                    HStack(spacing: 0) {
                        ForEach([("month", "月"), ("year", "年")], id: \.0) { item in
                            let key = item.0, label = item.1
                            let sel = v.tab == key
                            Button { if !sel { model.act { $0.setRepTab(key) } } } label: {
                                Text(label).font(.system(size: 13, weight: sel ? .bold : .medium))
                                    .foregroundStyle(sel ? ink("ink") : ink("ink-mut"))
                                    .frame(maxWidth: .infinity).padding(.vertical, 8)
                                    .background {
                                        if sel {
                                            RoundedRectangle(cornerRadius: 11).fill(ink("card"))
                                                .shadow(color: .black.opacity(0.12), radius: 4, y: 3)
                                        }
                                    }
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("report.tab.\(key)")
                            .accessibilityAddTraits(sel ? .isSelected : [])
                        }
                    }
                    .padding(2)
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                    .animation(.snappy(duration: 0.2), value: v.tab)
                    .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 8)
                }
                List {
                    if v.empty {
                        Text("まだ何もありません。予定を確定すると、何にどれだけ時間を使ったかが、ここに積み上がっていきます。")
                            .foregroundStyle(.secondary).listRowBackground(Color.clear)
                    } else if v.tab == "year" { yearBody(v) } else { monthBody(v) }
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("まとめ")
        }
        .shareCovers(from: "report")
    }

    @ViewBuilder func headView(_ h: ReportView.Head, _ sub: String, size: CGFloat = 40) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(h.num).font(.system(size: size, weight: .light)).tracking(-0.8).monospacedDigit()
                Text(h.unit).font(.system(size: 17)).foregroundStyle(ink("ink-mut"))
                if !h.rest.isEmpty { Text(h.rest).font(.system(size: 14)).foregroundStyle(ink("ink-mut")).padding(.leading, 4) }
            }
            Text(sub).font(.system(size: 11)).tracking(0.66).foregroundStyle(ink("ink-mut"))
        }
    }

    /// まとめカードへの行（Web 版の ShareRow）
    @ViewBuilder func shareRow(_ label: String, id: String, _ open: @escaping (Engine) -> Void) -> some View {
        Section("シェア") {
            Button { model.act(open) } label: {
                HStack(spacing: 12) {
                    Text("✓").font(.system(size: 13, weight: .heavy)).foregroundStyle(ink("ink"))
                        .frame(width: 26, height: 26).background(ink("bg2"), in: RoundedRectangle(cornerRadius: 7))
                    Text(label).font(.system(size: 14.5)).foregroundStyle(ink("ink"))
                    Spacer()
                    Image(systemName: "chevron.right").font(.footnote).foregroundStyle(ink("ink-faint"))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier(id)
        }
    }

    @ViewBuilder func kinds(_ ks: [JSONValue]) -> some View {
        ForEach(Array(ks.enumerated()), id: \.offset) { _, k in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Circle().fill(ink.css(k["color"]?.string)).frame(width: 9, height: 9)
                    Text(JS.string(k["name"]))
                    Text("\(JS.string(k["times"]))件").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text(JS.string(k["amount"])).monospacedDigit()
                }
                ForEach(Array((k["tops"]?.array ?? []).enumerated()), id: \.offset) { _, t in
                    HStack { Text(JS.string(t["name"])).font(.caption).foregroundStyle(.secondary); Spacer(); Text(JS.string(t["amount"])).font(.caption).monospacedDigit().foregroundStyle(.secondary) }
                        .padding(.leading, 17)
                }
            }
        }
    }

    @ViewBuilder func jobRows(_ js: [JSONValue], soft: Bool = false) -> some View {
        ForEach(Array(js.enumerated()), id: \.offset) { _, j in
            HStack {
                Circle().fill(ink.css(j["color"]?.string)).frame(width: 8, height: 8)
                Text(JS.string(j["name"])).font(.system(size: 13)).lineLimit(1).foregroundStyle(soft ? ink("ink-soft") : ink("ink")); Spacer()
                Text(JS.string(j["hours"])).font(.caption).foregroundStyle(.secondary)
                Text(JS.string(j["wage"])).monospacedDigit()
            }
        }
    }

    @ViewBuilder func monthBody(_ v: ReportView) -> some View {
        Section {
            HStack {
                Button { model.act { $0.set(["ym": Engine.shiftMonth($0.state["ym"], -1)]) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless).accessibilityLabel("前の月")
                Spacer(); Text("\(v.yearLabel) \(v.monthLabel)").font(.headline); Spacer()
                Button { model.act { $0.set(["ym": Engine.shiftMonth($0.state["ym"], 1)]) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless).accessibilityLabel("次の月")
            }
            if v.monthNone { Text("この月には、確定した予定がありません。").foregroundStyle(.secondary) }
            else { headView(v.monthHead, v.monthSub); kinds(v.monthKinds) }
        }
        if !v.overMonth.isEmpty || !v.leave.isEmpty {
            Section {
                if !v.overMonth.isEmpty { Text(v.overMonth) }
                if !v.leave.isEmpty { Text(v.leave) }
            }
        }
        if !v.payRows.isEmpty {
            Section("給料日ごと") {
                ForEach(Array(v.payRows.enumerated()), id: \.offset) { _, r in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.head).font(.system(size: 14)).foregroundStyle(ink("ink"))
                            Text("\(r.name)・\(r.range)・\(r.times)回").font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                        }
                        Spacer()
                        Text(r.wage).font(.system(size: 16)).monospacedDigit()
                    }
                }
            }
        }
        if v.wageShown {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text("¥").font(.system(size: 17)).foregroundStyle(ink("ink-mut"))
                        Text(String(v.monthWage.dropFirst())).font(.system(size: 30, weight: .light)).tracking(-0.6).monospacedDigit()
                    }
                    Text("働いた \(v.monthHours)・\(v.monthDays)日").font(.system(size: 11)).tracking(0.66).foregroundStyle(ink("ink-mut"))
                }
                if v.monthJobs.count >= 2 { jobRows(v.monthJobs) }
            } header: {
                Text("給料")
            } footer: {
                Text("金額は時給から出した目安で、割増や交通費は入っていません。").font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
            }
            shareRow("\(v.monthLabel)のまとめカード", id: "report.monthCard") { $0.openMonthCard() }
        }
    }

    @ViewBuilder func yearBody(_ v: ReportView) -> some View {
        Section {
            HStack {
                Button { model.act { $0.shiftRepYear(-1) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless).accessibilityLabel("前の年")
                Spacer(); Text(v.yearLabel).font(.headline); Spacer()
                Button { model.act { $0.shiftRepYear(1) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless).accessibilityLabel("次の年")
            }
        }
        Section("月ごとの時間") {
            VStack(spacing: 10) {
                HStack(alignment: .bottom, spacing: 3) {
                    ForEach(v.bars, id: \.label) { b in
                        Button { model.act { $0.openRepMonth(b.label - 1) } } label: {
                            VStack(spacing: 5) {
                                RoundedRectangle(cornerRadius: 4).fill(ink.css(b.color)).frame(maxWidth: 14).frame(height: CGFloat(b.height))
                                Text("\(b.label)").font(.system(size: 9, weight: b.isCur ? .bold : .medium)).foregroundStyle(b.isCur ? ink("ink") : ink("ink-faint"))
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(b.label)月")
                    }
                }
                .frame(height: 96, alignment: .bottom)
                .padding(.horizontal, 2)
                .animation(.snappy(duration: 0.3), value: v.bars)
                Text("押すと、その月へ").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).frame(maxWidth: .infinity)
            }
            .padding(.top, 6)
        }
        Section("\(v.yearLabel)の合計") { headView(v.yearHead, v.yearSub, size: 32); kinds(v.yearKinds) }
        if v.wageShown {
            Section {
                HStack { Text("働いた時間").font(.system(size: 14)).foregroundStyle(ink("ink-mut")); Spacer(); Text(v.yearHours).font(.system(size: 16)).monospacedDigit() }
                HStack { Text("働いた日数").font(.system(size: 14)).foregroundStyle(ink("ink-mut")); Spacer(); Text("\(v.yearDays)日").font(.system(size: 16)).monospacedDigit() }
                HStack { Text("稼いだ額").font(.system(size: 14)).foregroundStyle(ink("ink-mut")); Spacer(); Text("およそ \(v.yearWage)").font(.system(size: 16)).monospacedDigit() }
                if v.yearJobs.count >= 2 { jobRows(v.yearJobs, soft: true) }
            } header: {
                Text("給料")
            } footer: {
                VStack(alignment: .leading, spacing: 10) {
                    Text("時間は記録したそのものです。金額は時給から出した目安で、割増や交通費は入っていません。")
                    if !v.priorText.isEmpty { Text(v.priorText) }
                }
                .font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
            }
            Section {
                Button { model.act { $0.togglePrior() } } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("使い始める前の額").font(.system(size: 14.5)).foregroundStyle(ink("ink"))
                            Text(v.priorHint).font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                        }
                        Spacer()
                        Text(v.priorLabel).font(.system(size: 14)).monospacedDigit().foregroundStyle(ink("ink-mut"))
                        Image(systemName: v.priorOpen ? "chevron.down" : "chevron.right").font(.footnote).foregroundStyle(ink("ink-faint"))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if v.priorOpen {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            Text("\(v.yearLabel)のぶん").font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                            Spacer()
                            HStack(spacing: 3) {
                                Text("¥").font(.system(size: 14.5)).foregroundStyle(ink("ink-soft"))
                                TextField("0", text: Binding(get: { v.priorValue }, set: { s in model.act { $0.setPriorText(s) } }))
                                    .keyboardType(.numberPad).multilineTextAlignment(.trailing).monospacedDigit()
                                    .font(.system(size: 15)).frame(width: 90)
                            }
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                        }
                        Text("上の「稼いだ額」とまとめカードに足します。働いた時間と日数には入りません。").font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
                    }
                }
            }
            shareRow("\(v.yearLabel)のまとめカード", id: "report.yearCard") { $0.openYearCard() }
        }
    }
}
