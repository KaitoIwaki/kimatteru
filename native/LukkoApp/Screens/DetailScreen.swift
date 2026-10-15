import SwiftUI
import LukkoKit

/// 予定の詳細（Web 版の screen='detail'）
struct DetailScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @Environment(\.openURL) private var openURL

    var body: some View {
        let v = model.engine.detailView()
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                card(v)
                if let label = v.primaryLabel {
                    Button { model.act { $0.runDetailPrimary(v.primaryAction) } } label: {
                        Text(label).font(.system(size: 15)).frame(maxWidth: .infinity).padding(15)
                            .foregroundStyle(ink.css(v.primaryColor))
                            .background(ink.css(v.primaryBg), in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ink.css(String(v.primaryBorder.split(separator: " ").last ?? ""))))
                    }
                    .buttonStyle(.plain)
                }
                others(v)
                history(v)
            }
            .padding(16)
        }
        .background(ink("bg"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(v.menuRows, id: \.key) { r in
                        if r.key == "send", let ev = model.engine.detailEvent() {
                            ShareLink(item: model.engine.shareText(ev)) { Label(r.label, systemImage: "square.and.arrow.up") }
                        } else {
                            Button(role: r.red ? .destructive : nil) { model.act { $0.runDetailMenu(r.key) } } label: { Label(r.label, systemImage: icon(r.key)) }
                        }
                    }
                } label: { Image(systemName: "ellipsis") }
                .accessibilityLabel("予定の操作")
            }
        }
    }

    private func icon(_ key: String) -> String {
        ["fix": "clock.arrow.circlepath", "edit": "pencil", "move": "calendar.badge.clock", "rep": "chart.bar", "copy": "doc.on.doc", "del": "trash"][key] ?? "circle"
    }

    @ViewBuilder private func card(_ v: DetailView) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(v.badgeChar).font(.system(size: 14, weight: .bold)).foregroundStyle(ink.css(v.badgeColor))
                    .frame(width: 26, height: 26)
                    .background(ink.css(v.badgeBg), in: Circle())
                    .overlay { if !v.badgeBorder.isEmpty { Circle().strokeBorder(ink.css(String(v.badgeBorder.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                Text(v.statusLabel).font(.subheadline).foregroundStyle(ink.css(v.typeDark))
                if !v.candText.isEmpty {
                    Text(v.candText).font(.caption).padding(.horizontal, 8).padding(.vertical, 2)
                        .overlay(Capsule().strokeBorder(ink("ink-faint"), style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
                }
            }
            Text(v.title).font(.system(size: 21, weight: .semibold)).foregroundStyle(ink("ink"))
            VStack(alignment: .leading, spacing: 4) {
                Text(v.dateText).foregroundStyle(ink("ink-soft"))
                if !v.holText.isEmpty { Text(v.holText).font(.footnote).foregroundStyle(ink("sun")) }
                if !v.movedText.isEmpty { Text(v.movedText).font(.footnote).foregroundStyle(ink("ink-mut")) }
                HStack(spacing: 8) {
                    Text(v.timeText).monospacedDigit().foregroundStyle(ink("ink"))
                    if v.timeChanged { Text("→ 変更あり").font(.footnote).foregroundStyle(.orange) }
                }
                if !v.wantText.isEmpty { Text(v.wantText).font(.footnote).foregroundStyle(ink("ink-mut")) }
                if !v.remindText.isEmpty { Label(v.remindText, systemImage: "bell").font(.footnote).foregroundStyle(ink("ink-mut")) }
            }
            if !v.place.isEmpty, let url = URL(string: v.placeHref) {
                Button { openURL(url) } label: {
                    HStack { Image(systemName: "mappin.and.ellipse"); Text(v.place).lineLimit(2); Spacer(); Text("地図").font(.footnote) }
                }
                .buttonStyle(.plain).foregroundStyle(ink("ink"))
            }
            if !v.link.isEmpty, let url = URL(string: v.link) {
                Button { openURL(url) } label: {
                    Label(v.linkLabel, systemImage: "video").frame(maxWidth: .infinity).padding(14)
                        .foregroundStyle(ink("card")).background(ink("ink"), in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
            if !v.memo.isEmpty { Text(memoText(v.memoParts)).font(.subheadline).foregroundStyle(ink("ink-soft")).tint(.blue) }
            if v.wageShown {
                VStack(alignment: .leading, spacing: 4) {
                    HStack { Text("実働"); Spacer(); Text(v.workHours).monospacedDigit() }
                    if !v.breakText.isEmpty { Text(v.breakText).font(.footnote).foregroundStyle(ink("ink-mut")) }
                    HStack { Text("給料"); Spacer(); Text(v.wage).font(.title3.weight(.semibold)).monospacedDigit() }
                }
                .padding(12).background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink("line")))
    }

    /// メモの中の URL と電話番号を押せるように
    private func memoText(_ parts: [DetailView.Part]) -> AttributedString {
        var out = AttributedString()
        for p in parts {
            var a = AttributedString(p.t)
            if let h = p.href, let u = URL(string: h) { a.link = u; a.underlineStyle = .single }
            out += a
        }
        return out
    }

    @ViewBuilder private func others(_ v: DetailView) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(v.othersLabel).font(.footnote).foregroundStyle(ink("ink-mut")).padding(.horizontal, 16).padding(.vertical, 10)
            if v.others.isEmpty {
                Text("この日は、これだけです").font(.subheadline).foregroundStyle(ink("ink-mut")).padding(.horizontal, 16).padding(.bottom, 12)
            }
            ForEach(Array(v.others.enumerated()), id: \.offset) { i, o in
                Button {
                    if let ev = (model.state["events"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == o.id }) {
                        model.act { $0.openFor(ev, $0.state["returnTo"]) }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text(o.when).font(.caption).monospacedDigit().foregroundStyle(ink("ink-mut")).frame(width: 40, alignment: .leading)
                        Text(o.title).font(.caption).lineLimit(1).padding(.horizontal, 9).frame(maxWidth: .infinity, minHeight: 24, alignment: .leading)
                            .foregroundStyle(ink.css(o.pill["color"]?.string))
                            .background(ink.css(o.pill["background"]?.string), in: RoundedRectangle(cornerRadius: 5))
                            .overlay { if let b = o.pill["border"]?.string { RoundedRectangle(cornerRadius: 5).strokeBorder(ink.css(String(b.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .overlay(alignment: .top) { if i > 0 { Rectangle().fill(ink("line-faint")).frame(height: 1) } }
                }
                .buttonStyle(.plain)
            }
            if v.othersRest > 0 { Text("ほか \(v.othersRest)件").font(.caption).foregroundStyle(ink("ink-mut")).padding(.horizontal, 16).padding(.bottom, 10) }
        }
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder private func history(_ v: DetailView) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(v.histLabel).font(.footnote).foregroundStyle(ink("ink-mut"))
            if let h = v.hist {
                HStack { Text(h.year); Text(h.month) }.font(.subheadline)
                HStack { Text("前回 \(h.prev)"); Spacer(); Text(h.ago).foregroundStyle(ink("ink-mut")) }.font(.subheadline)
            } else {
                Text("これが、はじめてです").font(.subheadline).foregroundStyle(ink("ink-mut"))
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
    }
}

/// 「どうなった？」の小窓（iPhone 標準のシート）
struct DialogSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let v = model.engine.dialogView()
        NavigationStack {
            Form {
                if v.moving { moveBody(v) } else { mainBody(v) }
            }
            .navigationTitle(v.moving ? v.moveTitle : v.heading)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { model.act { v.moving ? $0.dlgMoveBack() : $0.dlgDismiss() } } label: { Image(systemName: v.moving ? "chevron.left" : "xmark") }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder func mainBody(_ v: DialogView) -> some View {
        Section {
            Text(v.sub).foregroundStyle(.secondary)
            DlgTimeRow(label: "開始", field: "start", value: v.start, open: v.startOpen, color: ink.css(v.openColor))
            DlgTimeRow(label: "終了", field: "end", value: v.end, open: v.endOpen, color: ink.css(v.openColor))
            if v.changed { Text("\(v.origText) → 変更あり").font(.footnote).foregroundStyle(.orange) }
        }
        if v.breakShown {
            Section("休憩") {
                ChipFlow(chips: v.breakChips.map { FormView.Chip(key: .number(Double($0.val)), label: $0.label, sel: $0.sel) }, accent: ink.css(v.typeColor)) { c in
                    model.act { $0.dlgSetBreak(c.key.int ?? 0) }
                }
                Text(v.paidText).font(.footnote).foregroundStyle(.secondary)
            }
        }
        Section {
            Button { model.act { $0.dlgPrimary() } } label: {
                Text(v.primaryLabel).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6).foregroundStyle(.white)
            }
            .listRowBackground(ink.css(v.primaryBg))
            Button(v.goneLabel, role: .destructive) { model.act { $0.dlgNakunatta() } }
            if v.moveShown { Button("別の日になった") { model.act { $0.dlgStartMove() } } }
            if !v.breakShown { Button(v.maybeLabel) { model.act { $0.dlgDismiss() } } }
        }
        Section {
            Button(v.editLabel) { model.act { $0.dlgEdit() } }.font(.footnote)
        }
    }

    @ViewBuilder func moveBody(_ v: DialogView) -> some View {
        Section {
            HStack {
                Button { model.act { $0.dlgShiftMove(-1) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless)
                Spacer(); Text(v.moveLabel).font(.subheadline.weight(.semibold)); Spacer()
                Button { model.act { $0.dlgShiftMove(1) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
                ForEach(Array(v.moveWeekdays.enumerated()), id: \.offset) { _, w in
                    Text(w.label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(w.color))
                }
                ForEach(Array(v.moveCells.enumerated()), id: \.offset) { _, c in
                    if let d = c.day {
                        Text("\(d)").font(.system(size: 14, weight: c.weight >= 700 ? .bold : .medium)).monospacedDigit()
                            .strikethrough(c.orig)
                            .foregroundStyle(ink.css(c.color))
                            .frame(maxWidth: .infinity).frame(height: 34)
                            .background(ink.css(c.bg), in: RoundedRectangle(cornerRadius: 11))
                            .contentShape(Rectangle())
                            .onTapGesture { if !c.orig { model.act { $0.dlgPickMoveDay(d) } } }
                    } else { Color.clear.frame(height: 34) }
                }
            }
            Text(v.moveChosenText).font(.footnote).foregroundStyle(.secondary)
        }
        Section {
            Button("この日で決まった") { model.act { $0.dlgMoveTo("kakutei") } }.disabled(!v.moveChosen)
            Button("この日に、まだ仮で置く") { model.act { $0.dlgMoveTo("mikakutei") } }.disabled(!v.moveChosen)
            Button("日にちはまだ決めない（今月のどこか）") { model.act { $0.dlgMoveSomeday() } }
        }
    }
}

/// 小窓の時刻の行（押すとドラム）
struct DlgTimeRow: View {
    let label: String, field: String, value: String, open: Bool, color: Color
    @Environment(AppModel.self) private var model
    var body: some View {
        Button { model.act { $0.dlgTapRow(field) } } label: {
            HStack { Text(label).foregroundStyle(.primary); Spacer(); Text(value).monospacedDigit().fontWeight(open ? .bold : .semibold).foregroundStyle(open ? color : .primary) }
        }
        if open {
            let p = value.split(separator: ":").map { Int($0) ?? 0 }
            HStack(spacing: 0) {
                Picker("時", selection: Binding(get: { p.first ?? 0 }, set: { h in model.act { $0.dlgSetWheel(field, unit: "h", index: h) } })) {
                    ForEach(0..<24, id: \.self) { Text(String(format: "%02d", $0)).tag($0) }
                }.pickerStyle(.wheel).frame(maxWidth: 90)
                Text(":")
                Picker("分", selection: Binding(get: { (p.count > 1 ? p[1] : 0) / 5 }, set: { i in model.act { $0.dlgSetWheel(field, unit: "m", index: i) } })) {
                    ForEach(0..<12, id: \.self) { Text(String(format: "%02d", $0 * 5)).tag($0) }
                }.pickerStyle(.wheel).frame(maxWidth: 90)
            }
            .frame(height: 150).frame(maxWidth: .infinity)
        }
    }
}
