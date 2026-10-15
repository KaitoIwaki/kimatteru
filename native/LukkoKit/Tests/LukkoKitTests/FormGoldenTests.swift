import XCTest
@testable import LukkoKit

/// 新しい予定／予定を編集の画面が、Web 版と同じ中身を出し、押したときに同じように変わるか（golden/form.json）
final class FormGoldenTests: XCTestCase {
    static func json(_ v: FormView) -> JSONValue {
        func chips(_ a: [FormView.Chip]) -> JSONValue { .array(a.map { ["label": .string($0.label), "sel": .bool($0.sel)] }) }
        func cells(_ a: [FormView.Cell]) -> JSONValue {
            .array(a.map { c in c.day == nil ? .null : ["day": .number(Double(c.day!)), "bg": .string(c.bg), "color": .string(c.color), "border": .string(c.border), "weight": .number(Double(c.weight))] })
        }
        let o: [String: JSONValue] = [
            "newTitle": .string(v.newTitle), "titlePlaceholder": .string(v.titlePlaceholder), "titleAutoFocus": .bool(v.titleAutoFocus), "editing": .bool(v.editing),
            "draftColor": .string(v.draftColor), "draftColorDeep": .string(v.draftColorDeep),
            "suggests": .array(v.suggests.map { ["label": .string($0.label), "color": .string($0.color)] }),
            "durChips": chips(v.durChips), "overlapNote": .string(v.overlapNote), "candShown": .bool(v.candShown), "candOn": .bool(v.candOn),
            "somedayChips": chips(v.somedayChips), "somedayOn": .bool(v.somedayOn), "somedayText": .string(v.somedayText), "secretOn": .bool(v.secretOn),
            "dateLabel": .string(v.dateLabel), "dateOpen": .bool(v.dateOpen), "dateExtraCount": .number(Double(v.dateExtraCount)), "dateSummary": .string(v.dateSummary),
            "dateHint": .string(v.dateHint), "datePickLabel": .string(v.datePickLabel), "ymPickOpen": .bool(v.ymPickOpen), "ymYearLabel": .string(v.ymYearLabel),
            "ymMonths": chips(v.ymMonths), "dateWeekdays": .array(v.dateWeekdays.map { [.string($0.label), .string($0.color)] }), "dateCells": cells(v.dateCells),
            "jobPickerShown": .bool(v.jobPickerShown), "jobWordNew": .string(v.jobWordNew), "jobThisNew": .string(v.jobThisNew),
            "jobChips": chips(v.jobChips), "jobNone": ["label": .string(v.jobNone.label), "sel": .bool(v.jobNone.sel)],
            "newJobShown": .bool(v.newJobShown), "newJobName": .string(v.newJobName), "newJobEg": .string(v.newJobEg), "newJobHourly": .string(v.newJobHourly),
            "timed": .bool(v.timed), "spanDays": .number(Double(v.spanDays)), "spanCountLabel": .string(v.spanCountLabel), "spanRangeLabel": .string(v.spanRangeLabel), "spanHint": .string(v.spanHint),
            "rowTypeOpen": .bool(v.rowTypeOpen), "typeValue": .string(v.typeValue), "typeColor": .string(v.typeColor), "rowJobOpen": .bool(v.rowJobOpen), "jobValue": .string(v.jobValue),
            "addChips": .array(v.addChips.map { .string($0.label) }),
            "repRowShown": .bool(v.repRowShown), "multiRowShown": .bool(v.multiRowShown), "placeRowShown": .bool(v.placeRowShown), "memoRowShown": .bool(v.memoRowShown), "linkRowShown": .bool(v.linkRowShown),
            "rowLinkOpen": .bool(v.rowLinkOpen), "linkValue": .string(v.linkValue), "rowPlaceOpen": .bool(v.rowPlaceOpen), "placeValue": .string(v.placeValue), "placePlaceholder": .string(v.placePlaceholder),
            "rowMemoOpen": .bool(v.rowMemoOpen), "memoValue": .string(v.memoValue),
            "rowMultiOpen": .bool(v.rowMultiOpen), "multiValue": .string(v.multiValue), "multiClearShown": .bool(v.multiClearShown), "multiHint": .string(v.multiHint), "multiPickLabel": .string(v.multiPickLabel), "multiCells": cells(v.multiCells),
            "rowRepOpen": .bool(v.rowRepOpen), "repValue": .string(v.repValue), "repNthShown": .bool(v.repNthShown), "repUntilShown": .bool(v.repUntilShown), "repDowShown": .bool(v.repDowShown), "repHint": .string(v.repHint),
            "repNthChips": chips(v.repNthChips), "repEveryChips": chips(v.repEveryChips), "repDowChips": chips(v.repDowChips), "repWeekChips": chips(v.repWeekChips),
            "rowRemindOpen": .bool(v.rowRemindOpen), "remindValue": .string(v.remindValue), "remindNote": .string(v.remindNote), "remindSeg": chips(v.remindSeg),
            "startValue": .string(v.startValue), "endValue": .string(v.endValue), "startOpen": .bool(v.startOpen), "endOpen": .bool(v.endOpen),
            "startDateText": .string(v.startDateText), "endDateText": .string(v.endDateText), "endNextDay": .bool(v.endNextDay), "crossNote": .string(v.crossNote),
            "chips": .array(v.chips.map { ["label": .string($0.label), "sel": .bool($0.sel)] }),
            "newTypeShown": .bool(v.newTypeShown), "newTypeName": .string(v.newTypeName), "newTypeEg": .string(v.newTypeEg),
            "swatches": .array(v.swatches.map { .bool($0.sel) }),
            "seg": chips(v.seg), "previewExplain": .string(v.previewExplain), "previewBg": .string(v.previewBg), "previewBorder": .string(v.previewBorder),
        ]
        return .object(o)
    }

    func testForm() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/form", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        let keys = ["draft", "newJob", "newType", "jobs", "types", "discardAsk", "screen", "returnTo", "events", "someday", "settings", "repEditAsk", "ym", "dayNum", "detailId", "today"]
        var fails = 0
        for (ci, c) in cases.enumerated() {
            let eng = Engine(state: c["init"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            var mapG: [String: String] = [:], mapW: [String: String] = [:]
            for (si, st) in (c["steps"]?.array ?? []).enumerated() {
                // 画面の中身
                let got = Self.json(eng.formView()), want = st["form"] ?? .null
                if got != want {
                    fails += 1
                    if fails <= 15 {
                        let go = got.object ?? [:], wo = want.object ?? [:]
                        let diff = Set(go.keys).union(wo.keys).filter { go[$0] != wo[$0] }.sorted()
                        XCTFail("#\(ci).\(si) 画面の中身が違う \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                    }
                    break
                }
                // 押す
                let op = st["op"] ?? .null
                func s(_ k: String) -> String { op[k]?.string ?? "" }
                func i(_ k: String) -> Int { op[k]?.int ?? 0 }
                switch op["h"]?.string ?? "" {
                case "title": eng.setDraftText("title", s("s"))
                case "place": eng.setDraftText("place", s("s"))
                case "memo": eng.setDraftText("memo", s("s"))
                case "link": eng.setDraftText("link", s("s"))
                case "suggest": eng.applySuggest(i("i"))
                case "dur": eng.setDuration(Double(i("m")))
                case "cand": eng.toggleCand()
                case "someday": eng.setSomeday(s("w"))
                case "secret": eng.toggleSecret()
                case "tapDate": eng.tapDate()
                case "pick": eng.shiftPick(i("n"))
                case "tapYM": eng.tapYM()
                case "year": eng.shiftPickYear(i("n"))
                case "month": eng.pickMonth(i("i"))
                case "day": eng.pickDay(i("d"))
                case "clearExtra": eng.clearExtraDays()
                case "pickJob": eng.pickJob(op["id"])
                case "clearJob": eng.clearJob()
                case "startNewJob": eng.startNewJob()
                case "newJobName": eng.setNewJobName(s("s"))
                case "newJobHourly": eng.setNewJobHourly(s("s"))
                case "newJobBump": eng.bumpNewJobHourly(Double(i("d")))
                case "cancelNewJob": eng.cancelNewJob()
                case "commitNewJob": eng.commitNewJob()
                case "span": eng.bumpSpan(i("d"))
                case "allDay": eng.toggleAllDay()
                case "row": eng.openRow(s("key"))
                case "addRow": eng.addRow(s("key"))
                case "dropRow": eng.dropRow(s("key"))
                case "tapMulti": eng.tapMultiRow()
                case "clearMulti": eng.clearMulti()
                case "multiDay":
                    let p = eng.pickYM
                    let dr = eng.draftObj
                    if !(dr["y"] == .number(Double(p.y)) && dr["m"] == .number(Double(p.m)) && dr["day"] == op["d"]) { eng.haptic("light"); eng.toggleExtraDay(p.y, p.m, i("d")) }
                case "repEvery": eng.setRepEvery(op["key"] ?? .null)
                case "repNth": eng.toggleRepNth(i("k"))
                case "repDow": eng.toggleRepDow(i("i"))
                case "repSpan": eng.setRepSpan(i("m"))
                case "remind": eng.setRemind(op["val"] ?? .null)
                case "timeRow": eng.tapTimeRow(s("f"))
                case "wheel": eng.setWheel(s("f"), unit: s("u"), index: i("idx"))
                case "type": eng.selectType(op["key"])
                case "toggleNewType": eng.toggleNewType()
                case "newTypeName": eng.setNewType(name: s("s"))
                case "newTypeColor": eng.setNewType(color: FormCore.pal[i("i")])
                case "addType": eng.addType()
                case "cancelNewType": eng.cancelNewType()
                case "status": eng.setStatus(s("k"))
                case "cancel": eng.cancelForm()
                case "save": eng.haptic("light"); eng.save()
                default: XCTFail("知らない操作 \(op)")
                }
                var o: [String: JSONValue] = [:]
                for k in keys { if let v = eng.state[k] { o[k] = v } }
                let g = ActionsGoldenTests.normalize(.object(o), &mapG), w = ActionsGoldenTests.normalize(st["state"] ?? .null, &mapW)
                if g != w {
                    fails += 1
                    if fails <= 15 {
                        let go = g.object ?? [:], wo = w.object ?? [:]
                        let diff = keys.filter { go[$0] != wo[$0] }
                        XCTFail("#\(ci).\(si) \(op) のあと、違う項目 \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                    }
                    break
                }
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
