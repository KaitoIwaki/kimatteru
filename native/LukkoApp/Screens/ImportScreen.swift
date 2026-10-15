import SwiftUI
import LukkoKit

/// iPhone のカレンダー・.ics から取り込む（Web 版の screen='import'）。1 歩ずつ：選ぶ → 確かめる → 入れた
struct ImportScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let im = model.state["imp"] ?? .null
        let phase = JS.string(im["phase"])
        let types = (model.state["types"]?.array ?? []).compactMap { $0.object }
        List {
            if !JS.string(im["error"]).isEmpty { Text(JS.string(im["error"])).foregroundStyle(.orange) }
            switch phase {
            case "scanning":
                HStack { ProgressView(); Text("読んでいます…") }
            case "cals":
                Section("読むカレンダー") {
                    ForEach(Array((im["cals"]?.array ?? []).enumerated()), id: \.offset) { _, c in
                        let ty = types.first { JS.truthy(c["type"]) && $0["key"] == c["type"] }
                        HStack {
                            Button { model.act { $0.toggleImportCal(c["id"]) } } label: {
                                HStack {
                                    Image(systemName: JS.truthy(c["on"]) ? "checkmark.circle.fill" : "circle").foregroundStyle(JS.truthy(c["on"]) ? .green : .secondary)
                                    Circle().fill(ink.css(JS.string(c["color"]))).frame(width: 9, height: 9)
                                    Text(JS.string(c["title"])).foregroundStyle(.primary)
                                }
                            }
                            .buttonStyle(.plain)
                            Spacer()
                            Button(ty.map { JS.string($0["name"]) } ?? "名前から当てる") { model.act { $0.cycleImportCalType(c["id"]) } }
                                .font(.caption).buttonStyle(.bordered)
                        }
                    }
                }
                Section("いつから") {
                    Picker("いつから", selection: Binding(get: { JS.string(JS.or(im["range"], "month")) }, set: { k in model.act { $0.setImportRange(k) } })) {
                        Text("先月から").tag("month"); Text("今年のはじめから").tag("year"); Text("1年前から").tag("back")
                    }
                    .pickerStyle(.segmented)
                }
                Section {
                    Button("読み込む") { Task { await model.engine.runRead(nil) } }
                        .disabled((im["cals"]?.array ?? []).filter { JS.truthy($0["on"]) }.isEmpty)
                }
            case "found":
                foundBody(im, types)
            case "done":
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(JS.string(im["tidied"]) == "" ? "\(JS.string(im["added"] ?? 0))件を入れました" : "\(JS.string(im["added"] ?? 0))件を片づけました").font(.title3.weight(.semibold))
                        let parts = [JS.truthy(im["updated"]) ? "\(JS.string(im["updated"]))件を元に合わせて直しました" : "",
                                     JS.truthy(im["removed"]) ? "元で消えた\(JS.string(im["removed"]))件を消しました（最近消した予定から戻せます）" : "",
                                     JS.truthy(im["withPlace"]) ? "場所つき \(JS.string(im["withPlace"]))件" : "",
                                     JS.truthy(im["multi"]) ? "何日も続く予定 \(JS.string(im["multi"]))件" : ""].filter { !$0.isEmpty }
                        if !parts.isEmpty { Text(parts.joined(separator: "・")).font(.footnote).foregroundStyle(.secondary) }
                        if JS.truthy(im["dashed"]) { Text("「仮」「候補」などが付いた\(JS.string(im["dashed"]))件は、点線（まだ）で置きました。").font(.footnote).foregroundStyle(.secondary) }
                    }
                }
                if !JS.truthy(im["tidied"]) && JS.truthy(model.state["settings"]?["lastImport"]) && JS.number(im["added"] ?? 0) > 0 {
                    Section { Button("取り込みを取り消す", role: .destructive) { model.act { $0.undoImport() } } }
                }
            default:
                Section {
                    Text("いま使っているカレンダーの予定を読み込みます。読むだけで、書き込みはしません。").font(.subheadline)
                    Button("iPhone のカレンダーから取り込む") { Task { await model.engine.runScan() } }
                }
            }
        }
        .navigationTitle("取り込み")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder func foundBody(_ im: JSONValue, _ types: [[String: JSONValue]]) -> some View {
        let found = im["found"]?.array ?? []
        let tidy = im["source"] == "tidy"
        if found.isEmpty {
            Text(tidy ? "整理するものはありません" : "取り込める予定は見つかりませんでした").foregroundStyle(.secondary)
        } else {
            Section {
                let g = found.filter { JS.truthy($0["guessed"]) }.count
                if g > 0 { Text("名前から\(g)件の種類を当てました。ちがっていたら押して直せます。").font(.footnote).foregroundStyle(.secondary) }
                Button(found.allSatisfy { JS.truthy($0["on"]) } ? "ぜんぶ外す" : "ぜんぶ選ぶ") { model.act { $0.setAllImport(!found.allSatisfy { JS.truthy($0["on"]) }) } }
            }
            Section {
                ForEach(Array(found.enumerated()), id: \.offset) { _, e in
                    let ty = types.first { $0["key"] == e["type"] } ?? types.first ?? [:]
                    let hex = JS.string(ty["color"])
                    HStack(spacing: 10) {
                        Image(systemName: JS.truthy(e["on"]) ? "checkmark.square.fill" : "square").foregroundStyle(JS.truthy(e["on"]) ? .green : .secondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(JS.string(e["title"])).lineLimit(1)
                            let when = "\(JS.string(.number(JS.number(e["m"]) + 1)))/\(JS.string(e["day"]))　" + (JS.truthy(e["allDay"]) ? (JS.number(e["days"] ?? .null) > 1 ? "\(JS.string(e["days"]))日間" : "終日") : "\(JS.string(e["start"]))–\(JS.string(e["end"]))") + (e["status"] == "mikakutei" ? "　まだ" : "")
                            Text(when).font(.caption).foregroundStyle(.secondary).monospacedDigit()
                            if e["kind"] == "changed" { Text("変わった（前は \(JS.string(e["was"]))）").font(.caption2).foregroundStyle(.orange) }
                            if e["kind"] == "gone" { Text("元で消えた・消すなら選ぶ").font(.caption2).foregroundStyle(.orange) }
                        }
                        Spacer()
                        if !tidy {
                            Button(JS.string(ty["name"])) { model.act { $0.cycleImportRowType(e["key"]) } }
                                .font(.caption.weight(.bold)).padding(.horizontal, 11).padding(.vertical, 5)
                                .foregroundStyle(ink.css(model.core.inkOn(hex, dark: model.dark)))
                                .background(ink.css(model.core.softFill(hex, dark: model.dark)), in: Capsule())
                                .buttonStyle(.plain)
                        }
                    }
                    .opacity(JS.truthy(e["on"]) ? 1 : 0.45)
                    .contentShape(Rectangle())
                    .onTapGesture { model.act { $0.toggleImportRow(e["key"]) } }
                }
            }
            Section {
                let n = found.filter { JS.truthy($0["on"]) }.count
                if tidy {
                    Button("まとめから外す（\(n)件）") { model.act { $0.tidySkip() } }.disabled(n == 0)
                    Button("消す（\(n)件）", role: .destructive) { model.act { $0.tidyDelete() } }.disabled(n == 0)
                } else {
                    Button("\(n)件を取り込む") { model.act { $0.doImport() } }.disabled(n == 0).buttonStyle(.borderedProminent)
                }
            }
        }
    }
}
