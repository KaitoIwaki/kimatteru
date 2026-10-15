import SwiftUI
import UIKit
import LukkoKit

/// 決まった色（Web 版で直に書いている色）
enum FormTone {
    /// 開いている行の値・選んだチップ（#1D9E75）
    static let teal = Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255)
    /// 翌日・説明の濃い緑（#0F6E56）
    static let deep = Color(red: 0x0F / 255, green: 0x6E / 255, blue: 0x56 / 255)
    /// 重なりの注意（#B9770F）
    static let amber = Color(red: 0xB9 / 255, green: 0x77 / 255, blue: 0x0F / 255)
    /// 変更あり（#D85A30）
    static let changed = Color(red: 0xD8 / 255, green: 0x5A / 255, blue: 0x30 / 255)
    /// 赤い字のボタン（#A8452B）
    static let red = Color(red: 0xA8 / 255, green: 0x45 / 255, blue: 0x2B / 255)
}

/// 新しい予定／予定を編集（Web 版の screen='new'）。iPhone 標準のシートと Form で作る。
/// 中身（言葉・選べるもの）は Engine.formView、押したときは Engine の同じ名前の操作。
///
/// - 書きかけがあるときは下へ払っても閉じない。払おうとしたら「書きかけを捨てますか？」を出す（✕ と同じ）
/// - 保存は右上の ✓ と、画面の下（キーボードが出ていればそのすぐ上）の「保存」
/// - 書きかけ・くり返しの編集の確認は、このシートの中で iPhone 標準のアラートを出す
struct FormScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @FocusState private var focus: Field?

    enum Field: Hashable { case title, link, place, memo, newType, newJob, hourly }

    var body: some View {
        let dr = model.state["draft"] ?? .null
        let v = model.engine.formView()
        NavigationStack {
            Form {
                titleSection(v, dr)
                statusSection(v)
                typeSection(v)
                if v.newTypeShown { newTypeSection(v) }
                if v.jobPickerShown && v.newJobShown { newJobSection(v) }
                dateSection(v)
                remindSection(v)
                addedSection(v, dr)
                if !v.addChips.isEmpty { addChipsSection(v) }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(v.newTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { cancel() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("閉じる")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: { Image(systemName: "checkmark").fontWeight(.semibold) }
                        .buttonStyle(.borderedProminent)
                        .buttonBorderShape(.circle)
                        .tint(ink.css(v.draftColor))
                        .accessibilityLabel("保存")
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) { saveBar(v) }
            .onAppear {
                // 新しい予定で題名が空のときだけ、すぐ打てるようにする
                if v.titleAutoFocus { DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { focus = .title } }
            }
        }
        .interactiveDismissDisabled(model.engine.draftDirty())
        // 日付・時刻・種類などの行を開いたら、キーボードはしまう（Web 版で入力欄の外を押したのと同じ）
        .onChange(of: JS.string(JS.or(dr["picking"], ""))) { _, p in
            if !p.isEmpty && !["link", "place", "memo"].contains(p) { focus = nil }
        }
        .background(FormDismissGuard { cancel() })
        .modifier(AlertPresenter(scope: .form))
    }

    private func save() {
        focus = nil
        model.act { e in e.haptic("light"); e.save() }
    }
    private func cancel() {
        focus = nil
        model.act { $0.cancelForm() }
    }

    /// 画面の下の「保存」（すりガラス。地は種類の色を 35% 暗くした色）
    private func saveBar(_ v: FormView) -> some View {
        Button { save() } label: {
            Text("保存").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(14)
                .background(ink.css(v.draftColorDeep), in: RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("form.saveBar")
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
    }

    // MARK: 題名とよく入れる予定
    @ViewBuilder func titleSection(_ v: FormView, _ dr: JSONValue) -> some View {
        Section {
            TextField(v.titlePlaceholder, text: Binding(get: { JS.string(JS.or(dr["title"], "")) }, set: { s in model.act { $0.setDraftText("title", s) } }))
                .font(.system(size: 15))
                .focused($focus, equals: .title)
                .submitLabel(.done)
                // Enter で保存（変換中の Enter は iPhone が確定に使うので、ここには来ない）
                .onSubmit { save() }
                .accessibilityIdentifier("form.title")
        }
        if !v.suggests.isEmpty {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        ForEach(Array(v.suggests.enumerated()), id: \.offset) { i, s in
                            Button { model.act { $0.applySuggest(i) } } label: {
                                HStack(spacing: 6) { Circle().fill(ink.css(s.color)).frame(width: 7, height: 7); Text(s.label) }
                                    .font(.system(size: 13)).foregroundStyle(ink("ink-soft"))
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(ink("card"), in: Capsule())
                                    .overlay(Capsule().strokeBorder(ink("line")))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
            .listSectionSpacing(6)
        }
    }

    // MARK: この予定は（決まってる／まだ）
    @ViewBuilder func statusSection(_ v: FormView) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 10) {
                Text("この予定は").font(.system(size: 13)).foregroundStyle(ink("ink"))
                Picker("この予定は", selection: Binding(get: { v.seg.first { $0.sel }?.key.string ?? "kakutei" }, set: { k in model.act { $0.setStatus(k) } })) {
                    ForEach(v.seg, id: \.label) { Text($0.label).tag($0.key.string ?? "") }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                HStack(spacing: 7) {
                    RoundedRectangle(cornerRadius: 3).fill(ink.css(v.previewBg)).frame(width: 14, height: 10)
                        .overlay { if v.previewDashed { RoundedRectangle(cornerRadius: 3).strokeBorder(ink.css(v.draftColor), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                    Text(v.previewExplain).font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                }
            }
            .padding(.vertical, 4)
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
                            Text(c.label).font(.system(size: 14, weight: c.sel ? .bold : .regular))
                                .foregroundStyle(c.sel ? .white : ink("ink-mut"))
                                .padding(.horizontal, 15).padding(.vertical, 10)
                                .background(c.sel ? ink.css(c.color) : ink("card"), in: RoundedRectangle(cornerRadius: 13))
                                .overlay { if !c.sel { RoundedRectangle(cornerRadius: 13).strokeBorder(ink("line")) } }
                        }
                        .buttonStyle(.plain)
                    }
                    Button { model.act { $0.toggleNewType() } } label: {
                        Text("＋ 種類").font(.system(size: 14)).foregroundStyle(ink("ink-soft"))
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(Palette.hex("#C9CDD4"), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 6)
                .listRowBackground(ink("bg2"))
            }
            if v.jobPickerShown {
                FoldRow(title: v.jobWordNew, value: v.jobValue, open: v.rowJobOpen) { model.act { $0.openRow("job") } }
                if v.rowJobOpen {
                    FlowLayout(spacing: 8) {
                        ForEach(Array((v.jobChips + [v.jobNone]).enumerated()), id: \.offset) { _, c in
                            FormChip(label: c.label, sel: c.sel, on: FormTone.teal) {
                                model.act { e in if c.key == .null { e.clearJob() } else { e.pickJob(c.key) } }
                            }
                        }
                        Button {
                            model.act { $0.startNewJob() }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { focus = .newJob }
                        } label: {
                            Text("＋ \(v.jobWordNew)").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .overlay(Capsule().strokeBorder(ink("line"), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 6)
                    .listRowBackground(ink("bg2"))
                }
            }
        }
    }

    /// 新しい種類（名前・12 色・やめる・この種類を追加）
    @ViewBuilder func newTypeSection(_ v: FormView) -> some View {
        Section {
            TextField(v.newTypeEg, text: Binding(get: { v.newTypeName }, set: { s in model.act { $0.setNewType(name: s) } }))
                .font(.system(size: 14.5))
                .focused($focus, equals: .newType)
            FlowLayout(spacing: 10) {
                ForEach(Array(v.swatches.enumerated()), id: \.offset) { _, sw in
                    Circle().fill(ink.css(sw.hex)).frame(width: 26, height: 26)
                        .overlay { if sw.sel { Circle().strokeBorder(ink("card"), lineWidth: 2).padding(-2); Circle().strokeBorder(ink.css(sw.hex), lineWidth: 2).padding(-4) } }
                        .padding(4)
                        .contentShape(Circle())
                        .onTapGesture { model.act { $0.setNewType(color: sw.hex) } }
                }
            }
            .padding(.vertical, 6)
            HStack(spacing: 8) {
                Button { focus = nil; model.act { $0.cancelNewType() } } label: {
                    Text("やめる").font(.system(size: 14)).foregroundStyle(ink("ink-soft")).frame(maxWidth: .infinity).padding(11)
                        .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                Button { focus = nil; model.act { $0.addType() } } label: {
                    Text("この種類を追加").font(.system(size: 14, weight: .bold)).foregroundStyle(.white).frame(maxWidth: .infinity).padding(11)
                        .background(ink.css(v.newTypeColor), in: RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 4)
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    /// その場で勤務先を足す（名前・時給・やめる・この◯◯を追加）
    @ViewBuilder func newJobSection(_ v: FormView) -> some View {
        Section {
            TextField(v.newJobEg, text: Binding(get: { v.newJobName }, set: { s in model.act { $0.setNewJobName(s) } }))
                .font(.system(size: 14.5))
                .focused($focus, equals: .newJob)
            HStack(spacing: 10) {
                Text("時給").font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                Spacer()
                FormStepButton(label: "−", faded: false) { model.act { $0.bumpNewJobHourly(-10) } }
                    .accessibilityLabel("時給を10円下げる")
                HStack(spacing: 3) {
                    Text("¥").font(.system(size: 14.5)).foregroundStyle(ink("ink-soft"))
                    TextField("0", text: Binding(get: { v.newJobHourly }, set: { s in
                        // 最大 5 文字（数字以外は Engine が捨てる）
                        model.act { $0.setNewJobHourly(String(s.prefix(5))) }
                    }))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 62)
                    .focused($focus, equals: .hourly)
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
                FormStepButton(label: "＋", faded: false) { model.act { $0.bumpNewJobHourly(10) } }
                    .accessibilityLabel("時給を10円上げる")
            }
            HStack(spacing: 8) {
                Button { focus = nil; model.act { $0.cancelNewJob() } } label: {
                    Text("やめる").font(.system(size: 14)).foregroundStyle(ink("ink-soft")).frame(maxWidth: .infinity).padding(11)
                        .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                Button { focus = nil; model.act { $0.commitNewJob() } } label: {
                    Text(v.jobThisNew).font(.system(size: 14, weight: .bold)).foregroundStyle(.white).frame(maxWidth: .infinity).padding(11)
                        .background(FormTone.teal, in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: 日にち・終日・時刻
    @ViewBuilder func dateSection(_ v: FormView) -> some View {
        Section {
            Button { model.act { $0.tapDate() } } label: {
                HStack(spacing: 7) {
                    Text("日にち").font(.system(size: 14.5)).foregroundStyle(ink("ink"))
                    Spacer()
                    if !v.dateSummary.isEmpty { Text(v.dateSummary).font(.system(size: 12)).foregroundStyle(FormTone.teal) }
                    Text(v.dateLabel).font(.system(size: 14.5, weight: v.dateOpen ? .bold : .medium)).monospacedDigit()
                        .foregroundStyle(v.dateOpen ? FormTone.teal : ink("ink-mut")).lineLimit(1)
                    FormChevron(open: v.dateOpen)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("form.date")
            if v.dateOpen {
                VStack(spacing: 0) {
                    MiniCalendar(label: v.datePickLabel, ymOpen: v.ymPickOpen, year: v.ymYearLabel, months: v.ymMonths, weekdays: v.dateWeekdays, cells: v.dateCells, multi: false)
                    if !v.ymPickOpen {
                        HStack {
                            Text(v.dateHint).font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
                            Spacer()
                            if v.dateExtraCount > 0 {
                                Button("ほかの日を外す") { model.act { $0.clearExtraDays() } }.font(.system(size: 12)).foregroundStyle(ink("ink-mut")).buttonStyle(.plain)
                            }
                        }
                        .padding(.top, 8)
                        // 日にちがまだ決まっていない予定（通院・美容院・帰省など）。月表示の上の棚に置く
                        if !v.somedayChips.isEmpty {
                            VStack(alignment: .leading, spacing: 7) {
                                Rectangle().fill(ink("line")).frame(height: 1).padding(.bottom, 3)
                                Text("日にちはまだ決めない").font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                                FlowLayout(spacing: 6) {
                                    ForEach(Array(v.somedayChips.enumerated()), id: \.offset) { _, c in
                                        FormChip(label: c.label, sel: c.sel, on: ink("ink"), onText: ink("card"), size: 12.5) { model.act { $0.setSomeday(c.key.string ?? "") } }
                                    }
                                }
                            }
                            .padding(.top, 10)
                        }
                    }
                }
                .padding(.vertical, 6)
                .listRowBackground(ink("bg2"))
            }
            if v.somedayOn {
                Text(v.somedayText).font(.system(size: 12)).foregroundStyle(ink("ink-soft"))
            }
            Toggle(isOn: Binding(get: { !v.timed }, set: { _ in model.act { $0.toggleAllDay() } })) {
                Text("終日予定").font(.system(size: 14.5))
            }
            .tint(FormTone.teal)
            if v.timed {
                TimeRow(label: "開始", date: v.startDateText, value: v.startValue, open: v.startOpen, field: "start", tapDate: true)
                TimeRow(label: "終了", date: v.endDateText, value: v.endValue, open: v.endOpen, field: "end", tapDate: false, dateHighlight: v.endNextDay)
                if !v.durChips.isEmpty {
                    FlowLayout(spacing: 6) {
                        Text("長さ").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).padding(.vertical, 6)
                        ForEach(v.durChips, id: \.label) { c in
                            FormChip(label: c.label, sel: c.sel, on: ink("ink"), onText: ink("card"), size: 12, padH: 11, padV: 6) {
                                model.act { $0.setDuration(c.key.number ?? 60) }
                            }
                        }
                    }
                }
                if !v.crossNote.isEmpty { Text(v.crossNote).font(.system(size: 11.5)).foregroundStyle(FormTone.deep) }
                if !v.overlapNote.isEmpty { Text(v.overlapNote).font(.system(size: 11.5)).foregroundStyle(FormTone.amber) }
            } else {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("何日間").font(.system(size: 14.5))
                        if !v.spanRangeLabel.isEmpty {
                            Text(v.spanRangeLabel).font(.system(size: 11, weight: .semibold)).monospacedDigit().foregroundStyle(FormTone.teal)
                        }
                    }
                    Spacer()
                    HStack(spacing: 12) {
                        FormStepButton(label: "−", faded: v.spanDays <= 1) { model.act { $0.bumpSpan(-1) } }
                            .accessibilityLabel("1日減らす")
                        Text(v.spanCountLabel).font(.system(size: 15)).monospacedDigit().frame(minWidth: 52)
                        FormStepButton(label: "＋", faded: v.spanDays >= 60) { model.act { $0.bumpSpan(1) } }
                            .accessibilityLabel("1日増やす")
                    }
                }
            }
        }
    }

    // MARK: お知らせ・名前を隠す
    @ViewBuilder func remindSection(_ v: FormView) -> some View {
        Section {
            FoldRow(title: "お知らせ", value: v.remindValue, open: v.rowRemindOpen) { model.act { $0.openRow("remind") } }
            if v.rowRemindOpen {
                VStack(alignment: .leading, spacing: 9) {
                    FlowLayout(spacing: 8) {
                        ForEach(Array(v.remindSeg.enumerated()), id: \.offset) { _, c in
                            FormChip(label: c.label, sel: c.sel, on: FormTone.teal) { model.act { $0.setRemind(c.key) } }
                        }
                    }
                    if !v.remindNote.isEmpty { Text(v.remindNote).font(.system(size: 11)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 4) }
                }
                .padding(.vertical, 6)
                .listRowBackground(ink("bg2"))
            }
            Toggle(isOn: Binding(get: { v.secretOn }, set: { _ in model.act { $0.toggleSecret() } })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("名前を隠す").font(.system(size: 14.5))
                    Text("ウィジェットと通知では「予定あり」とだけ出します").font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                }
            }
            .tint(FormTone.teal)
        }
    }

    // MARK: ＋で足した行（並びは固定：複数日→くり返し→Web会議・リンク→場所→メモ）
    @ViewBuilder func addedSection(_ v: FormView, _ dr: JSONValue) -> some View {
        if v.multiRowShown || v.repRowShown || v.linkRowShown || v.placeRowShown || v.memoRowShown {
            Section {
                if v.multiRowShown {
                    RemovableRow(title: "複数日", value: v.multiValue, open: v.rowMultiOpen, tap: { model.act { $0.tapMultiRow() } }, remove: { model.act { $0.dropRow("multi") } })
                    if v.rowMultiOpen {
                        VStack(spacing: 0) {
                            MiniCalendar(label: v.multiPickLabel, ymOpen: false, year: "", months: [], weekdays: v.dateWeekdays, cells: v.multiCells, multi: true)
                            HStack {
                                Text(v.multiHint).font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
                                Spacer()
                                if v.multiClearShown {
                                    Button("ぜんぶ外す") { model.act { $0.clearMulti() } }.font(.system(size: 12)).foregroundStyle(ink("ink-mut")).buttonStyle(.plain)
                                }
                            }
                            .padding(.top, 8)
                        }
                        .padding(.vertical, 6)
                        .listRowBackground(ink("bg2"))
                    }
                    // 候補日。まだの予定を何日かに置くときだけ。1つ確定したら残りを片づけられる
                    if v.candShown {
                        Toggle(isOn: Binding(get: { v.candOn }, set: { _ in model.act { $0.toggleCand() } })) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("どれか1日に決まる（候補日）").font(.system(size: 14.5))
                                Text("1つ確定したら、ほかの候補を片づけるか聞きます").font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                            }
                        }
                        .tint(FormTone.teal)
                    }
                }
                if v.repRowShown {
                    RemovableRow(title: "くり返し", value: v.repValue, open: v.rowRepOpen, tap: { model.act { $0.openRow("rep") } }, remove: { model.act { $0.dropRow("rep") } })
                    if v.rowRepOpen {
                        VStack(alignment: .leading, spacing: 13) {
                            FlowLayout(spacing: 8) {
                                ForEach(Array(v.repEveryChips.enumerated()), id: \.offset) { _, c in
                                    FormChip(label: c.label, sel: c.sel, on: FormTone.teal) { model.act { $0.setRepEvery(c.key) } }
                                }
                            }
                            if v.repNthShown { SegmentChips(chips: v.repNthChips) { c in model.act { $0.toggleRepNth(c.key.int ?? 1) } } }
                            if v.repDowShown { SegmentChips(chips: v.repDowChips) { c in model.act { $0.toggleRepDow(c.key.int ?? 0) } } }
                            if v.repUntilShown {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("いつまで").font(.system(size: 12)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 4)
                                    FlowLayout(spacing: 8) {
                                        ForEach(Array(v.repWeekChips.enumerated()), id: \.offset) { _, c in
                                            FormChip(label: c.label, sel: c.sel, on: ink("ink"), onText: ink("card")) { model.act { $0.setRepSpan(c.key.int ?? 3) } }
                                        }
                                    }
                                    Text(v.repHint).font(.system(size: 11)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 4)
                                }
                            }
                        }
                        .padding(.vertical, 8)
                        .listRowBackground(ink("bg2"))
                    }
                }
                if v.linkRowShown {
                    RemovableRow(title: "Web会議・リンク", value: v.linkValue, open: v.rowLinkOpen, tap: { model.act { $0.openRow("link") } }, remove: { model.act { $0.dropRow("link") } })
                    if v.rowLinkOpen {
                        VStack(alignment: .leading, spacing: 9) {
                            FormInput {
                                TextField("https://（Zoom・Teams・Meet など）", text: Binding(get: { JS.string(JS.or(dr["link"], "")) }, set: { s in model.act { $0.setDraftText("link", s) } }))
                                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                                    .focused($focus, equals: .link)
                            }
                            Text("予定を開くと「参加する」ですぐ開けます").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 4)
                        }
                        .padding(.vertical, 6)
                        .listRowBackground(ink("bg2"))
                    }
                }
                if v.placeRowShown {
                    RemovableRow(title: "場所", value: v.placeValue, open: v.rowPlaceOpen, tap: { model.act { $0.openRow("place") } }, remove: { model.act { $0.dropRow("place") } })
                    if v.rowPlaceOpen {
                        VStack(alignment: .leading, spacing: 9) {
                            FormInput {
                                TextField(v.placePlaceholder, text: Binding(get: { JS.string(JS.or(dr["place"], "")) }, set: { s in model.act { $0.setDraftText("place", s) } }))
                                    .focused($focus, equals: .place)
                            }
                            Text("入れておくと、予定を開いたときに地図で開けます").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 4)
                        }
                        .padding(.vertical, 6)
                        .listRowBackground(ink("bg2"))
                    }
                }
                if v.memoRowShown {
                    RemovableRow(title: "メモ", value: v.memoValue, open: v.rowMemoOpen, tap: { model.act { $0.openRow("memo") } }, remove: { model.act { $0.dropRow("memo") } })
                    if v.rowMemoOpen {
                        FormInput {
                            TextField("持ち物や覚えておきたいこと", text: Binding(get: { JS.string(JS.or(dr["memo"], "")) }, set: { s in model.act { $0.setDraftText("memo", s) } }), axis: .vertical)
                                .lineLimit(4, reservesSpace: true)
                                .focused($focus, equals: .memo)
                        }
                        .padding(.vertical, 6)
                        .listRowBackground(ink("bg2"))
                    }
                }
            }
        }
    }

    /// 「＋」と点線のチップ（くり返し・複数日・場所・Web会議・リンク・メモ）
    @ViewBuilder func addChipsSection(_ v: FormView) -> some View {
        Section {
            HStack(alignment: .top, spacing: 10) {
                Text("＋").font(.system(size: 16)).foregroundStyle(ink("ink-faint")).frame(width: 26).padding(.vertical, 8)
                FlowLayout(spacing: 8) {
                    ForEach(v.addChips, id: \.label) { c in
                        Button { model.act { $0.addRow(c.key.string ?? "") } } label: {
                            Text(c.label).font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .overlay(Capsule().strokeBorder(Palette.hex("#C9CDD4"), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("＋ \(c.label)")
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18))
            .listRowBackground(Color.clear)
        }
    }
}

/// 入力欄（カードの地に角丸 12）
struct FormInput<Content: View>: View {
    @ViewBuilder let content: Content
    @Environment(\.ink) private var ink
    var body: some View {
        content
            .font(.system(size: 14.5))
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// 丸いチップ（選ぶと塗る）
struct FormChip: View {
    let label: String, sel: Bool, on: Color
    var onText: Color = .white
    var size: CGFloat = 13
    var padH: CGFloat = 14, padV: CGFloat = 8
    let tap: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: tap) {
            Text(label).font(.system(size: size, weight: sel ? .bold : .regular))
                .foregroundStyle(sel ? onText : ink("ink-mut"))
                .padding(.horizontal, padH).padding(.vertical, padV)
                .background(sel ? on : ink("card"), in: Capsule())
                .overlay(Capsule().strokeBorder(sel ? on : ink("line")))
                .lineLimit(1)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(sel ? .isSelected : [])
    }
}

/// −／＋ の丸ボタン（端では薄く）
struct FormStepButton: View {
    let label: String, faded: Bool
    let tap: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: tap) {
            Text(label).font(.system(size: 17)).foregroundStyle(ink("ink"))
                .frame(width: 34, height: 34)
                .background(ink("bg2"), in: Circle())
        }
        .buttonStyle(.borderless)
        .opacity(faded ? 0.35 : 1)
    }
}

/// 行の右の ›（開くと 90° 回る）
struct FormChevron: View {
    let open: Bool
    @Environment(\.ink) private var ink
    var body: some View {
        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink("ink-faint"))
            .rotationEffect(.degrees(open ? 90 : 0))
            .animation(.snappy(duration: 0.22), value: open)
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
            HStack(spacing: 7) {
                Text(title).font(.system(size: 14.5)).foregroundStyle(ink("ink")).layoutPriority(1)
                Spacer(minLength: 10)
                if let dot { Circle().fill(dot).frame(width: 9, height: 9) }
                Text(value).font(.system(size: 14.5, weight: open ? .bold : .medium))
                    .foregroundStyle(open ? FormTone.teal : ink("ink-mut")).lineLimit(1)
                FormChevron(open: open)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("form.row.\(title)")
    }
}

/// ✕ で消せる行
struct RemovableRow: View {
    let title: String, value: String, open: Bool
    let tap: () -> Void, remove: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 7) {
            Button(action: tap) {
                HStack(spacing: 7) {
                    Text(title).font(.system(size: 14.5)).foregroundStyle(ink("ink")).layoutPriority(1)
                    Spacer(minLength: 10)
                    Text(value).font(.system(size: 14.5, weight: open ? .bold : .medium))
                        .foregroundStyle(open ? FormTone.teal : ink("ink-mut")).lineLimit(1)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Button(action: remove) {
                Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(ink("ink-mut"))
                    .frame(width: 24, height: 24).background(ink("bg2"), in: Circle())
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("\(title)を外す")
        }
    }
}

/// 開始・終了の行。左に日付（開始だけ押せる）、右に時刻。時刻を押すと iPhone のドラム（時・分。分は 5 分刻み）
struct TimeRow: View {
    let label: String, date: String, value: String, open: Bool, field: String, tapDate: Bool
    var dateHighlight = false
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 7) {
            Text(label).font(.system(size: 14.5))
            Spacer(minLength: 8)
            if tapDate {
                Button { model.act { $0.tapDate() } } label: {
                    Text(date).font(.system(size: 13.5)).foregroundStyle(ink("ink-soft"))
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.borderless)
            } else {
                // 終わりの日付は選ばせない（翌日になるときだけ緑で知らせる）
                Text(date).font(.system(size: 13.5, weight: dateHighlight ? .bold : .regular))
                    .foregroundStyle(dateHighlight ? FormTone.deep : ink("ink-faint"))
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(dateHighlight ? FormTone.teal.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 10))
            }
            Button { model.act { $0.tapTimeRow(field) } } label: {
                Text(value).font(.system(size: 14.5, weight: open ? .bold : .semibold)).monospacedDigit()
                    .foregroundStyle(open ? FormTone.teal : ink("ink"))
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("\(label) \(value)")
            .accessibilityIdentifier("form.time.\(field)")
        }
        if open {
            TimeWheels(value: value, height: 170) { unit, idx in model.act { $0.setWheel(field, unit: unit, index: idx) } }
                .listRowBackground(ink("bg2"))
        }
    }
}

/// 時・分のドラム（iPhone 標準のホイール）。分は 5 分刻み
struct TimeWheels: View {
    let value: String
    let height: CGFloat
    let set: (_ unit: String, _ index: Int) -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        let p = value.split(separator: ":").map { Int($0) ?? 0 }
        HStack(spacing: 4) {
            Picker("時", selection: Binding(get: { min(23, max(0, p.first ?? 0)) }, set: { set("h", $0) })) {
                ForEach(0..<24, id: \.self) { Text(String(format: "%02d", $0)).monospacedDigit().tag($0) }
            }
            .pickerStyle(.wheel).frame(width: 90).clipped()
            Text(":").font(.system(size: 18, weight: .light))
            Picker("分", selection: Binding(get: { min(11, max(0, (p.count > 1 ? p[1] : 0) / 5)) }, set: { set("m", $0) })) {
                ForEach(0..<12, id: \.self) { Text(String(format: "%02d", $0 * 5)).monospacedDigit().tag($0) }
            }
            .pickerStyle(.wheel).frame(width: 90).clipped()
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
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
                Button { model.act { $0.shiftPick(-1) } } label: { Text("‹").font(.system(size: 22)).frame(width: 34, height: 34) }
                    .buttonStyle(.borderless).foregroundStyle(ink("ink-mut")).opacity(ymOpen ? 0 : 1).disabled(ymOpen)
                    .accessibilityLabel("前の月")
                Spacer()
                if multi { Text(label).font(.system(size: 14, weight: .bold)).monospacedDigit() }
                else {
                    Button { model.act { $0.tapYM() } } label: {
                        HStack(spacing: 5) {
                            Text(label).monospacedDigit()
                            Text("▾").font(.system(size: 10)).rotationEffect(.degrees(ymOpen ? 180 : 0))
                        }
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(ymOpen ? ink("card") : ink("ink"))
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(ymOpen ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 11))
                        .overlay { if !ymOpen { RoundedRectangle(cornerRadius: 11).strokeBorder(ink("line")) } }
                        .animation(.easeOut(duration: 0.18), value: ymOpen)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("年と月をえらぶ")
                }
                Spacer()
                Button { model.act { $0.shiftPick(1) } } label: { Text("›").font(.system(size: 22)).frame(width: 34, height: 34) }
                    .buttonStyle(.borderless).foregroundStyle(ink("ink-mut")).opacity(ymOpen ? 0 : 1).disabled(ymOpen)
                    .accessibilityLabel("次の月")
            }
            if ymOpen {
                HStack(spacing: 22) {
                    Button { model.act { $0.shiftPickYear(-1) } } label: { Text("‹").font(.system(size: 22)).frame(width: 34, height: 34) }
                        .buttonStyle(.borderless).foregroundStyle(ink("ink-mut")).accessibilityLabel("前の年")
                    Text(year).font(.system(size: 17)).monospacedDigit().frame(minWidth: 64)
                    Button { model.act { $0.shiftPickYear(1) } } label: { Text("›").font(.system(size: 22)).frame(width: 34, height: 34) }
                        .buttonStyle(.borderless).foregroundStyle(ink("ink-mut")).accessibilityLabel("次の年")
                }
                .padding(.bottom, 6)
                FormGrid(count: months.count, columns: 4, hSpacing: 7, vSpacing: 7) { i in
                    let mo = months[i]
                    Button { model.act { $0.pickMonth(i) } } label: {
                        Text(mo.label).font(.system(size: 14, weight: mo.sel ? .bold : .medium)).frame(maxWidth: .infinity).padding(.vertical, 11)
                            .foregroundStyle(mo.sel ? ink("card") : ink("ink-soft"))
                            .background(mo.sel ? ink("ink") : ink("card"), in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(mo.sel ? ink("ink") : ink("line")))
                    }
                    .buttonStyle(.borderless)
                }
            } else {
                // List の中なので、Lazy の格子は使わない（行の高さの計算が終わらず落ちる）
                FormGrid(count: weekdays.count, columns: 7, hSpacing: 0, vSpacing: 0) { i in
                    Text(weekdays[i].label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(weekdays[i].color)).padding(.bottom, 2)
                }
                FormGrid(count: cells.count, columns: 7, hSpacing: 0, vSpacing: 2) { i in
                    let c = cells[i]
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
                                        // 本体の日は押しても何もしない
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
                                .accessibilityAddTraits(.isButton)
                                .accessibilityIdentifier(multi ? "form.multi.\(d)" : "form.day.\(d)")
                    } else {
                        Color.clear.frame(height: 36)
                    }
                }
            }
        }
    }
}

/// 格子（List の中でも落ちないように、Lazy でない行と列で並べる）
struct FormGrid<Cell: View>: View {
    let count: Int, columns: Int, hSpacing: CGFloat, vSpacing: CGFloat
    @ViewBuilder let cell: (Int) -> Cell
    var body: some View {
        VStack(spacing: vSpacing) {
            ForEach(0..<((count + columns - 1) / columns), id: \.self) { r in
                HStack(spacing: hSpacing) {
                    ForEach(0..<columns, id: \.self) { c in
                        if r * columns + c < count { cell(r * columns + c).frame(maxWidth: .infinity) }
                        else { Color.clear.frame(maxWidth: .infinity, maxHeight: 1) }
                    }
                }
            }
        }
    }
}

/// 折り返すチップ（押せる）
struct ChipFlow: View {
    let chips: [FormView.Chip]
    var accent: Color = FormTone.teal
    /// 選んだときに墨で塗る（いつまで・日にちをまだ決めない）
    var dark = false
    let tap: (FormView.Chip) -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                FormChip(label: c.label, sel: c.sel, on: dark ? ink("ink") : accent, onText: dark ? ink("card") : .white) { tap(c) }
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
        HStack(spacing: 5) {
            ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                Button { tap(c) } label: {
                    Text(c.label).font(.system(size: 13, weight: c.sel ? .bold : .medium)).frame(maxWidth: .infinity).padding(.vertical, 9)
                        .foregroundStyle(c.sel ? .white : ink("ink-mut"))
                        .background(c.sel ? FormTone.teal : ink("card"), in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(c.sel ? FormTone.teal : ink("line")))
                }
                .buttonStyle(.borderless)
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

/// シートを下へ払おうとしたとき（書きかけがあって払えないとき）に知らせる。
///
/// SwiftUI には「払おうとした」を受け取る口が無いので、シートの UIKit の presentationController の delegate を
/// 間に入って受ける。SwiftUI がもともと持っている delegate には、ぜんぶそのまま渡す
struct FormDismissGuard: UIViewControllerRepresentable {
    let onAttempt: () -> Void
    func makeUIViewController(context: Context) -> Controller { Controller(onAttempt: onAttempt) }
    func updateUIViewController(_ vc: Controller, context: Context) {
        vc.onAttempt = onAttempt
        vc.hook()
    }

    final class Controller: UIViewController {
        var onAttempt: () -> Void
        private var proxy: Proxy?
        init(onAttempt: @escaping () -> Void) { self.onAttempt = onAttempt; super.init(nibName: nil, bundle: nil) }
        required init?(coder: NSCoder) { fatalError() }
        override func viewDidLoad() { super.viewDidLoad(); view.isUserInteractionEnabled = false; view.backgroundColor = .clear }
        override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); hook() }
        func hook() {
            guard let pc = presentationController else { return }
            if let p = proxy, pc.delegate === p { return }
            let p = Proxy(original: pc.delegate) { [weak self] in self?.onAttempt() }
            proxy = p
            pc.delegate = p
        }
    }

    final class Proxy: NSObject, UIAdaptivePresentationControllerDelegate {
        /// SwiftUI の delegate（ここで持っておく。presentationController は delegate を弱く持つ）
        let original: UIAdaptivePresentationControllerDelegate?
        let attempt: () -> Void
        init(original: UIAdaptivePresentationControllerDelegate?, attempt: @escaping () -> Void) { self.original = original; self.attempt = attempt }

        func presentationControllerDidAttemptToDismiss(_ pc: UIPresentationController) {
            original?.presentationControllerDidAttemptToDismiss?(pc)
            attempt()
        }
        func presentationControllerShouldDismiss(_ pc: UIPresentationController) -> Bool {
            original?.presentationControllerShouldDismiss?(pc) ?? true
        }
        func presentationControllerWillDismiss(_ pc: UIPresentationController) { original?.presentationControllerWillDismiss?(pc) }
        func presentationControllerDidDismiss(_ pc: UIPresentationController) { original?.presentationControllerDidDismiss?(pc) }
        // そのほか（シートの高さが変わった など）は、もとの delegate へそのまま
        override func responds(to sel: Selector!) -> Bool { super.responds(to: sel) || (original?.responds(to: sel) ?? false) }
        override func forwardingTarget(for sel: Selector!) -> Any? {
            if let o = original, o.responds(to: sel) { return o }
            return super.forwardingTarget(for: sel)
        }
    }
}
