import SwiftUI
import LukkoKit

/// 新しい予定／予定を編集（Web 版の screen='new'）。iPhone 標準のシートと Form で作る。
/// 中身（言葉・選べるもの）は Engine.formView、押したときは Engine の同じ名前の操作
struct FormScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @FocusState private var titleFocused: Bool

    var body: some View {
        let v = model.engine.formView()
        let dr = model.state["draft"] ?? .null
        NavigationStack {
            Form {
                titleSection(v, dr)
                Section {
                    Picker("この予定は", selection: Binding(get: { v.seg.first { $0.sel }?.key.string ?? "kakutei" }, set: { k in model.act { $0.setStatus(k) } })) {
                        ForEach(v.seg, id: \.label) { Text($0.label).tag($0.key.string ?? "") }
                    }
                    .pickerStyle(.segmented)
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 3).fill(ink.css(v.previewBg)).frame(width: 10, height: 10)
                            .overlay { if v.previewDashed { RoundedRectangle(cornerRadius: 3).strokeBorder(ink.css(v.draftColor), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                        Text(v.previewExplain).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                typeSection(v)
                dateSection(v)
                timeSection(v)
                Section {
                    FoldRow(title: "お知らせ", value: v.remindValue, open: v.rowRemindOpen) { model.act { $0.openRow("remind") } }
                    if v.rowRemindOpen {
                        ChipFlow(chips: v.remindSeg) { c in model.act { $0.setRemind(c.key) } }
                        if !v.remindNote.isEmpty { Text(v.remindNote).font(.footnote).foregroundStyle(.secondary) }
                    }
                    Toggle(isOn: Binding(get: { v.secretOn }, set: { _ in model.act { $0.toggleSecret() } })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("名前を隠す")
                            Text("ウィジェットと通知では「予定あり」とだけ出します").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                addedSections(v, dr)
                if !v.addChips.isEmpty {
                    Section {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                Image(systemName: "plus").foregroundStyle(.secondary)
                                ForEach(v.addChips, id: \.label) { c in
                                    Button(c.label) { model.act { $0.addRow(c.key.string ?? "") } }
                                        .font(.subheadline).foregroundStyle(ink("ink-mut"))
                                        .padding(.horizontal, 14).padding(.vertical, 8)
                                        .overlay(Capsule().strokeBorder(ink("line"), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(v.newTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { model.act { $0.cancelForm() } } label: { Image(systemName: "xmark") }.accessibilityLabel("閉じる")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { model.act { e in e.haptic("light"); e.save() } } label: { Image(systemName: "checkmark") }
                        .accessibilityLabel("保存")
                        .tint(ink.css(v.draftColorDeep))
                }
            }
            .onAppear { if v.titleAutoFocus { titleFocused = true } }
        }
        .interactiveDismissDisabled(model.engine.draftDirty())
    }

    // MARK: 題名とよく入れる予定
    @ViewBuilder func titleSection(_ v: FormView, _ dr: JSONValue) -> some View {
        Section {
            TextField(v.titlePlaceholder, text: Binding(get: { JS.string(JS.or(dr["title"], "")) }, set: { s in model.act { $0.setDraftText("title", s) } }))
                .font(.title3)
                .focused($titleFocused)
                .submitLabel(.done)
                .onSubmit { model.act { e in e.haptic("light"); e.save() } }
            if !v.suggests.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(v.suggests.enumerated()), id: \.offset) { i, s in
                            Button { model.act { $0.applySuggest(i) } } label: {
                                HStack(spacing: 6) { Circle().fill(ink.css(s.color)).frame(width: 7, height: 7); Text(s.label) }
                                    .font(.subheadline).padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(ink("bg2"), in: Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: 種類・勤務先
    @ViewBuilder func typeSection(_ v: FormView) -> some View {
        Section {
            FoldRow(title: "種類", value: v.typeValue, open: v.rowTypeOpen, dot: ink.css(v.typeColor)) { model.act { $0.openRow("type") } }
            if v.rowTypeOpen {
                FlowLayout(spacing: 8) {
                    ForEach(Array(v.chips.enumerated()), id: \.offset) { _, c in
                        Button { model.act { $0.selectType(c.key) } } label: {
                            Text(c.label).font(.subheadline)
                                .foregroundStyle(c.sel ? .white : ink("ink-mut"))
                                .padding(.horizontal, 15).padding(.vertical, 9)
                                .background(c.sel ? ink.css(c.color) : ink("card"), in: RoundedRectangle(cornerRadius: 13))
                                .overlay { if !c.sel { RoundedRectangle(cornerRadius: 13).strokeBorder(ink("line")) } }
                        }
                        .buttonStyle(.plain)
                    }
                    Button { model.act { $0.toggleNewType() } } label: {
                        Text("＋ 種類").font(.subheadline).foregroundStyle(ink("ink-soft"))
                            .padding(.horizontal, 14).padding(.vertical, 9)
                            .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(Color.gray.opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                    }
                    .buttonStyle(.plain)
                }
                if v.newTypeShown {
                    TextField(v.newTypeEg, text: Binding(get: { v.newTypeName }, set: { s in model.act { $0.setNewType(name: s) } }))
                    FlowLayout(spacing: 10) {
                        ForEach(Array(v.swatches.enumerated()), id: \.offset) { _, sw in
                            Circle().fill(ink.css(sw.hex)).frame(width: 26, height: 26)
                                .overlay { if sw.sel { Circle().strokeBorder(.white, lineWidth: 2).padding(-1); Circle().strokeBorder(ink.css(sw.hex), lineWidth: 2).padding(-4) } }
                                .onTapGesture { model.act { $0.setNewType(color: sw.hex) } }
                        }
                    }
                    HStack {
                        Button("やめる") { model.act { $0.cancelNewType() } }.buttonStyle(.bordered)
                        Button("この種類を追加") { model.act { $0.addType() } }.buttonStyle(.borderedProminent).tint(ink.css(v.newTypeColor))
                    }
                }
            }
            if v.jobPickerShown {
                FoldRow(title: v.jobWordNew, value: v.jobValue, open: v.rowJobOpen) { model.act { $0.openRow("job") } }
                if v.rowJobOpen {
                    ChipFlow(chips: v.jobChips + [v.jobNone], accent: Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255)) { c in
                        model.act { e in if c.key == .null { e.clearJob() } else { e.pickJob(c.key) } }
                    }
                    if v.newJobShown {
                        TextField(v.newJobEg, text: Binding(get: { v.newJobName }, set: { s in model.act { $0.setNewJobName(s) } }))
                        HStack {
                            Text("時給")
                            Spacer()
                            Button { model.act { $0.bumpNewJobHourly(-10) } } label: { Image(systemName: "minus.circle") }.buttonStyle(.borderless)
                            TextField("0", text: Binding(get: { v.newJobHourly }, set: { s in model.act { $0.setNewJobHourly(s) } }))
                                .keyboardType(.numberPad).multilineTextAlignment(.center).frame(width: 80)
                            Button { model.act { $0.bumpNewJobHourly(10) } } label: { Image(systemName: "plus.circle") }.buttonStyle(.borderless)
                        }
                        HStack {
                            Button("やめる") { model.act { $0.cancelNewJob() } }.buttonStyle(.bordered)
                            Button(v.jobThisNew) { model.act { $0.commitNewJob() } }.buttonStyle(.borderedProminent)
                        }
                    } else {
                        Button("＋ \(v.jobWordNew)") { model.act { $0.startNewJob() } }
                    }
                }
            }
        }
    }

    // MARK: 日にち
    @ViewBuilder func dateSection(_ v: FormView) -> some View {
        Section {
            Button { model.act { $0.tapDate() } } label: {
                HStack {
                    Text("日にち").foregroundStyle(ink("ink"))
                    Spacer()
                    Text(v.dateLabel).foregroundStyle(v.dateOpen ? Color.accentColor : ink("ink-mut")).monospacedDigit()
                    if !v.dateSummary.isEmpty { Text(v.dateSummary).foregroundStyle(.green) }
                }
            }
            if v.dateOpen {
                MiniCalendar(label: v.datePickLabel, ymOpen: v.ymPickOpen, year: v.ymYearLabel, months: v.ymMonths, weekdays: v.dateWeekdays, cells: v.dateCells, multi: false)
                if !v.dateHint.isEmpty {
                    HStack {
                        Text(v.dateHint).font(.footnote).foregroundStyle(.secondary)
                        Spacer()
                        if v.dateExtraCount > 0 { Button("ほかの日を外す") { model.act { $0.clearExtraDays() } }.font(.footnote) }
                    }
                }
            }
            if !v.somedayChips.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("日にちをまだ決めない").font(.footnote).foregroundStyle(.secondary)
                    ChipFlow(chips: v.somedayChips, dark: true) { c in model.act { $0.setSomeday(c.key.string ?? "") } }
                }
            }
            if !v.somedayText.isEmpty { Text(v.somedayText).font(.footnote).foregroundStyle(.secondary) }
        }
    }

    // MARK: 終日・時刻
    @ViewBuilder func timeSection(_ v: FormView) -> some View {
        Section {
            Toggle("終日予定", isOn: Binding(get: { !v.timed }, set: { _ in model.act { $0.toggleAllDay() } }))
            if v.timed {
                TimeRow(label: "開始", date: v.startDateText, value: v.startValue, open: v.startOpen, field: "start", tapDate: true)
                TimeRow(label: "終了", date: v.endDateText, value: v.endValue, open: v.endOpen, field: "end", tapDate: false, dateHighlight: v.endNextDay)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(v.durChips, id: \.label) { c in
                            Button(c.label) { model.act { $0.setDuration(c.key.number ?? 60) } }
                                .font(.caption).padding(.horizontal, 11).padding(.vertical, 6)
                                .foregroundStyle(c.sel ? ink("card") : ink("ink-mut"))
                                .background(c.sel ? ink("ink") : ink("card"), in: Capsule())
                                .overlay(Capsule().strokeBorder(c.sel ? ink("ink") : ink("line")))
                                .buttonStyle(.plain)
                        }
                    }
                }
                if !v.crossNote.isEmpty { Text(v.crossNote).font(.footnote).foregroundStyle(.green) }
                if !v.overlapNote.isEmpty { Text(v.overlapNote).font(.footnote).foregroundStyle(.orange) }
            } else {
                HStack {
                    Text("何日間")
                    Spacer()
                    if !v.spanRangeLabel.isEmpty { Text(v.spanRangeLabel).foregroundStyle(.green).font(.subheadline) }
                    Text(v.spanCountLabel).monospacedDigit()
                    Stepper("", onIncrement: { model.act { $0.bumpSpan(1) } }, onDecrement: { model.act { $0.bumpSpan(-1) } }).labelsHidden()
                }
                if !v.spanHint.isEmpty { Text(v.spanHint).font(.footnote).foregroundStyle(.secondary) }
            }
        }
    }

    // MARK: ＋で足した行（並びは固定：複数日→くり返し→Web会議・リンク→場所→メモ）
    @ViewBuilder func addedSections(_ v: FormView, _ dr: JSONValue) -> some View {
        if v.multiRowShown {
            Section {
                RemovableRow(title: "複数日", value: v.multiValue, open: v.rowMultiOpen, tap: { model.act { $0.tapMultiRow() } }, remove: { model.act { $0.dropRow("multi") } })
                if v.rowMultiOpen {
                    MiniCalendar(label: v.multiPickLabel, ymOpen: false, year: "", months: [], weekdays: v.dateWeekdays, cells: v.multiCells, multi: true)
                    HStack {
                        Text(v.multiHint).font(.footnote).foregroundStyle(.secondary)
                        Spacer()
                        if v.multiClearShown { Button("ぜんぶ外す") { model.act { $0.clearMulti() } }.font(.footnote) }
                    }
                    if v.candShown {
                        Toggle("どれか1日に決まる（候補日）", isOn: Binding(get: { v.candOn }, set: { _ in model.act { $0.toggleCand() } }))
                    }
                }
            }
        }
        if v.repRowShown {
            Section {
                RemovableRow(title: "くり返し", value: v.repValue, open: v.rowRepOpen, tap: { model.act { $0.openRow("rep") } }, remove: { model.act { $0.dropRow("rep") } })
                if v.rowRepOpen {
                    ChipFlow(chips: v.repEveryChips) { c in model.act { $0.setRepEvery(c.key) } }
                    if v.repNthShown { SegmentChips(chips: v.repNthChips) { c in model.act { $0.toggleRepNth(c.key.int ?? 1) } } }
                    if v.repDowShown { SegmentChips(chips: v.repDowChips) { c in model.act { $0.toggleRepDow(c.key.int ?? 0) } } }
                    if v.repUntilShown {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("いつまで").font(.footnote).foregroundStyle(.secondary)
                            ChipFlow(chips: v.repWeekChips, dark: true) { c in model.act { $0.setRepSpan(c.key.int ?? 3) } }
                        }
                    }
                    if !v.repHint.isEmpty { Text(v.repHint).font(.footnote).foregroundStyle(.secondary) }
                }
            }
        }
        if v.linkRowShown {
            Section {
                RemovableRow(title: "Web会議・リンク", value: v.linkValue, open: v.rowLinkOpen, tap: { model.act { $0.openRow("link") } }, remove: { model.act { $0.dropRow("link") } })
                if v.rowLinkOpen {
                    TextField("https://", text: Binding(get: { JS.string(JS.or(dr["link"], "")) }, set: { s in model.act { $0.setDraftText("link", s) } }))
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    Text("予定を開くと「参加する」ですぐ開けます").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        if v.placeRowShown {
            Section {
                RemovableRow(title: "場所", value: v.placeValue, open: v.rowPlaceOpen, tap: { model.act { $0.openRow("place") } }, remove: { model.act { $0.dropRow("place") } })
                if v.rowPlaceOpen {
                    TextField(v.placePlaceholder, text: Binding(get: { JS.string(JS.or(dr["place"], "")) }, set: { s in model.act { $0.setDraftText("place", s) } }))
                    Text("入れておくと、予定を開いたときに地図で開けます").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        if v.memoRowShown {
            Section {
                RemovableRow(title: "メモ", value: v.memoValue, open: v.rowMemoOpen, tap: { model.act { $0.openRow("memo") } }, remove: { model.act { $0.dropRow("memo") } })
                if v.rowMemoOpen {
                    TextEditor(text: Binding(get: { JS.string(JS.or(dr["memo"], "")) }, set: { s in model.act { $0.setDraftText("memo", s) } }))
                        .frame(minHeight: 96)
                }
            }
        }
    }
}

/// たたんだ行（名前・値・›）。押すと開閉
struct FoldRow: View {
    let title: String, value: String, open: Bool
    var dot: Color? = nil
    let tap: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: tap) {
            HStack(spacing: 8) {
                Text(title).foregroundStyle(ink("ink"))
                Spacer()
                if let dot { Circle().fill(dot).frame(width: 9, height: 9) }
                Text(value).foregroundStyle(open ? Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255) : ink("ink-mut"))
                    .fontWeight(open ? .bold : .medium).lineLimit(1)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(ink("ink-faint"))
                    .rotationEffect(.degrees(open ? 90 : 0))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.22), value: open)
    }
}

/// ✕ で消せる行
struct RemovableRow: View {
    let title: String, value: String, open: Bool
    let tap: () -> Void, remove: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        HStack {
            FoldRow(title: title, value: value, open: open, tap: tap)
            Button(action: remove) { Image(systemName: "xmark.circle.fill").foregroundStyle(ink("ink-faint")) }
                .buttonStyle(.borderless).accessibilityLabel("\(title)を消す")
        }
    }
}

/// 開始・終了の行。時刻を押すと iPhone のドラム（時・分。分は 5 分刻み）
struct TimeRow: View {
    let label: String, date: String, value: String, open: Bool, field: String, tapDate: Bool
    var dateHighlight = false
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Button(date) { if tapDate { model.act { $0.tapDate() } } }
                .foregroundStyle(dateHighlight ? .green : ink("ink-mut")).buttonStyle(.borderless).disabled(!tapDate)
            Button(value) { model.act { $0.tapTimeRow(field) } }
                .monospacedDigit().fontWeight(open ? .bold : .regular)
                .foregroundStyle(open ? Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255) : ink("ink"))
                .buttonStyle(.borderless)
        }
        if open {
            let p = value.split(separator: ":").map { Int($0) ?? 0 }
            HStack(spacing: 0) {
                Picker("時", selection: Binding(get: { p.first ?? 0 }, set: { h in model.act { $0.setWheel(field, unit: "h", index: h) } })) {
                    ForEach(0..<24, id: \.self) { Text(String(format: "%02d", $0)).tag($0) }
                }
                .pickerStyle(.wheel).frame(maxWidth: 90)
                Text(":")
                Picker("分", selection: Binding(get: { (p.count > 1 ? p[1] : 0) / 5 }, set: { i in model.act { $0.setWheel(field, unit: "m", index: i) } })) {
                    ForEach(0..<12, id: \.self) { Text(String(format: "%02d", $0 * 5)).tag($0) }
                }
                .pickerStyle(.wheel).frame(maxWidth: 90)
            }
            .frame(height: 170)
            .frame(maxWidth: .infinity)
        }
    }
}

/// 小さなカレンダー（日にちえらび・複数日えらび）
struct MiniCalendar: View {
    let label: String, ymOpen: Bool, year: String
    let months: [FormView.Chip]
    let weekdays: [(label: String, color: String)]
    let cells: [FormView.Cell]
    let multi: Bool
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Button { model.act { $0.shiftPick(-1) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless).opacity(ymOpen ? 0 : 1).disabled(ymOpen)
                Spacer()
                if multi { Text(label).font(.subheadline.weight(.semibold)) }
                else {
                    Button { model.act { $0.tapYM() } } label: {
                        HStack(spacing: 4) { Text(label); Image(systemName: "chevron.down").rotationEffect(.degrees(ymOpen ? 180 : 0)) }
                            .font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.borderless)
                }
                Spacer()
                Button { model.act { $0.shiftPick(1) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless).opacity(ymOpen ? 0 : 1).disabled(ymOpen)
            }
            if ymOpen {
                HStack {
                    Button { model.act { $0.shiftPickYear(-1) } } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless)
                    Text("\(year)年").font(.subheadline)
                    Button { model.act { $0.shiftPickYear(1) } } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 8) {
                    ForEach(Array(months.enumerated()), id: \.offset) { i, mo in
                        Button { model.act { $0.pickMonth(i) } } label: {
                            Text(mo.label).font(.subheadline.weight(mo.sel ? .bold : .medium)).frame(maxWidth: .infinity).padding(.vertical, 11)
                                .foregroundStyle(mo.sel ? ink("card") : ink("ink-soft"))
                                .background(mo.sel ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 11))
                                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(mo.sel ? ink("ink") : ink("line")))
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
                    ForEach(Array(weekdays.enumerated()), id: \.offset) { _, w in
                        Text(w.label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(w.color))
                    }
                    ForEach(Array(cells.enumerated()), id: \.offset) { _, c in
                        if let d = c.day {
                            Text("\(d)").font(.system(size: 14, weight: c.weight >= 700 ? .bold : .medium)).monospacedDigit()
                                .foregroundStyle(ink.css(c.color))
                                .frame(maxWidth: .infinity).frame(height: 36)
                                .background(ink.css(c.bg), in: RoundedRectangle(cornerRadius: 12))
                                .overlay {
                                    if !c.border.hasSuffix("transparent") {
                                        RoundedRectangle(cornerRadius: 12).strokeBorder(ink.css(String(c.border.split(separator: " ").last ?? "")), lineWidth: c.border.hasPrefix("1.5") ? 1.5 : 1)
                                    }
                                }
                                .opacity(multi && c.isMain ? 0.55 : 1)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    if multi {
                                        guard !c.isMain else { return }
                                        model.act { e in
                                            e.haptic("light")
                                            let p = e.pickYM
                                            e.toggleExtraDay(p.y, p.m, d)
                                        }
                                    } else {
                                        model.act { $0.pickDay(d) }
                                    }
                                }
                        } else {
                            Color.clear.frame(height: 36)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// 折り返すチップ（押せる）
struct ChipFlow: View {
    let chips: [FormView.Chip]
    var accent: Color = Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255)
    /// 選んだときに墨で塗る（いつまで・日にちをまだ決めない）
    var dark = false
    let tap: (FormView.Chip) -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                let on = dark ? ink("ink") : accent
                Button { tap(c) } label: {
                    Text(c.label).font(.subheadline.weight(c.sel ? .bold : .medium))
                        .foregroundStyle(c.sel ? (dark ? ink("card") : .white) : ink("ink-mut"))
                        .padding(.horizontal, 13).padding(.vertical, 8)
                        .background(c.sel ? on : ink("card"), in: Capsule())
                        .overlay(Capsule().strokeBorder(c.sel ? on : ink("line")))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
    }
}

/// 横いっぱいに並べる選択（第◯・曜日）
struct SegmentChips: View {
    let chips: [FormView.Chip]
    let tap: (FormView.Chip) -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                let accent = Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255)
                Button { tap(c) } label: {
                    Text(c.label).font(.subheadline.weight(c.sel ? .bold : .medium)).frame(maxWidth: .infinity).padding(.vertical, 9)
                        .foregroundStyle(c.sel ? .white : ink("ink-mut"))
                        .background(c.sel ? accent : ink("card"), in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(c.sel ? accent : ink("line")))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// 折り返して並べる
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, widest: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > maxW { y += rowH + spacing; x = 0; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height); widest = max(widest, x - spacing)
        }
        return CGSize(width: min(maxW, widest), height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { y += rowH + spacing; x = bounds.minX; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}
