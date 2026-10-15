import SwiftUI
import LukkoKit

/// まとめ（Web 版の screen='report'）
struct ReportScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let v = model.engine.reportView()
        NavigationStack {
            List {
                if v.empty {
                    Text("まだ何もありません。予定を確定すると、何にどれだけ時間を使ったかが、ここに積み上がっていきます。")
                        .foregroundStyle(.secondary).listRowBackground(Color.clear)
                } else {
                    Picker("期間", selection: Binding(get: { v.tab }, set: { k in model.act { $0.setRepTab(k) } })) {
                        Text("月").tag("month"); Text("年").tag("year")
                    }
                    .pickerStyle(.segmented).listRowBackground(Color.clear)
                    if v.tab == "year" { yearBody(v) } else { monthBody(v) }
                }
            }
            .navigationTitle("まとめ")
        }
    }

    @ViewBuilder func headView(_ h: ReportView.Head, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(h.num).font(.system(size: 44, weight: .light)).monospacedDigit()
                Text(h.unit).font(.title3).foregroundStyle(.secondary)
                if !h.rest.isEmpty { Text(h.rest).font(.title3).foregroundStyle(.secondary) }
            }
            Text(sub).font(.footnote).foregroundStyle(.secondary)
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

    @ViewBuilder func jobRows(_ js: [JSONValue]) -> some View {
        ForEach(Array(js.enumerated()), id: \.offset) { _, j in
            HStack {
                Circle().fill(ink.css(j["color"]?.string)).frame(width: 8, height: 8)
                Text(JS.string(j["name"])); Spacer()
                Text(JS.string(j["hours"])).font(.caption).foregroundStyle(.secondary)
                Text(JS.string(j["wage"])).monospacedDigit()
            }
        }
    }

    @ViewBuilder func monthBody(_ v: ReportView) -> some View {
        Section {
            HStack {
                Button { model.act { $0.set(["ym": Engine.shiftMonth($0.state["ym"], -1)]) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless)
                Spacer(); Text("\(v.yearLabel) \(v.monthLabel)").font(.headline); Spacer()
                Button { model.act { $0.set(["ym": Engine.shiftMonth($0.state["ym"], 1)]) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless)
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
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.head).font(.caption).foregroundStyle(.secondary)
                        HStack { Text("\(r.name)・\(r.range)・\(r.times)回").font(.subheadline); Spacer(); Text(r.wage).monospacedDigit() }
                    }
                }
            }
        }
        if v.wageShown {
            Section("給料") {
                Text(v.monthWage).font(.system(size: 34, weight: .light)).monospacedDigit()
                Text("働いた \(v.monthHours)・\(v.monthDays)日").font(.footnote).foregroundStyle(.secondary)
                if v.monthJobs.count >= 2 { jobRows(v.monthJobs) }
                Text("金額は時給から出した目安で、割増や交通費は入っていません。").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder func yearBody(_ v: ReportView) -> some View {
        Section {
            HStack {
                Button { model.act { $0.shiftRepYear(-1) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless)
                Spacer(); Text(v.yearLabel).font(.headline); Spacer()
                Button { model.act { $0.shiftRepYear(1) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("月ごとの時間").font(.caption).foregroundStyle(.secondary)
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(v.bars, id: \.label) { b in
                        Button { model.act { $0.openRepMonth(b.label - 1) } } label: {
                            VStack(spacing: 5) {
                                RoundedRectangle(cornerRadius: 4).fill(ink.css(b.color)).frame(height: CGFloat(b.height))
                                Text("\(b.label)").font(.system(size: 9, weight: b.isCur ? .bold : .medium)).foregroundStyle(b.isCur ? ink("ink") : ink("ink-faint"))
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(height: 96, alignment: .bottom)
                .animation(.snappy, value: v.bars)
                Text("押すと、その月へ").font(.caption2).foregroundStyle(.secondary)
            }
        }
        Section("\(v.yearLabel)の合計") { headView(v.yearHead, v.yearSub); kinds(v.yearKinds) }
        if v.wageShown {
            Section("給料") {
                HStack { Text("働いた時間"); Spacer(); Text(v.yearHours).monospacedDigit() }
                HStack { Text("働いた日数"); Spacer(); Text("\(v.yearDays)日").monospacedDigit() }
                HStack { Text("稼いだ額"); Spacer(); Text("およそ \(v.yearWage)").monospacedDigit() }
                if v.yearJobs.count >= 2 { jobRows(v.yearJobs) }
                if !v.priorText.isEmpty { Text(v.priorText).font(.caption).foregroundStyle(.secondary) }
                Button { model.act { $0.togglePrior() } } label: {
                    HStack {
                        VStack(alignment: .leading) { Text("使い始める前の額").foregroundStyle(.primary); Text(v.priorHint).font(.caption).foregroundStyle(.secondary) }
                        Spacer(); Text(v.priorLabel).foregroundStyle(.secondary)
                        Image(systemName: v.priorOpen ? "chevron.down" : "chevron.right").font(.footnote).foregroundStyle(.tertiary)
                    }
                }
                if v.priorOpen {
                    HStack {
                        Text("\(v.yearLabel)のぶん ¥")
                        TextField("0", text: Binding(get: { v.priorValue }, set: { s in model.act { $0.setPriorText(s) } })).keyboardType(.numberPad)
                    }
                    Text("上の『稼いだ額』とまとめカードに足します。働いた時間と日数には入りません。").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }
}
