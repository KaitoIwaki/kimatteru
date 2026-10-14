import Foundation

/// iCloud で 2 台の iPhone の予定をそろえる（Web 版 app/src/sync.js の packForSync・mergeSync の写し）
public enum SyncCore {
    public typealias Obj = [String: JSONValue]

    /// 同期で渡すもの（設定は渡さない）。tomb は消した印（id と消した時刻）
    public static func packForSync(_ state: Obj) -> JSONValue {
        func arr(_ k: String) -> JSONValue { JS.or(state[k], .array([])) ?? .array([]) }
        var tomb: [JSONValue] = []
        for x in state["trash"]?.array ?? [] {
            let ev = x["ev"]
            let id: JSONValue? = JS.truthy(ev) ? ev?["id"] : ev
            tomb.append(.array([id ?? .null, x["at"] ?? .null]))
        }
        for g in state["gone"]?.array ?? [] { tomb.append(g) }
        tomb = tomb.filter { t in JS.truthy(t) && JS.truthy(t.array?.first) }
        return .object(["v": .number(1), "events": arr("events"), "types": arr("types"), "jobs": arr("jobs"), "someday": arr("someday"), "tomb": .array(tomb)])
    }

    /// 並びを保ったままの辞書（JS の Map と同じく、入れた順に回る）
    struct OrderedMap<V> {
        var keys: [JSONValue] = []
        var dict: [JSONValue: V] = [:]
        subscript(k: JSONValue) -> V? {
            get { dict[k] }
            set {
                if let v = newValue { if dict[k] == nil { keys.append(k) }; dict[k] = v }
                else if dict[k] != nil { dict[k] = nil; keys.removeAll { $0 == k } }
            }
        }
        var values: [V] { keys.compactMap { dict[$0] } }
    }

    static func jsMax(_ a: Double, _ b: Double) -> Double { (a.isNaN || b.isNaN) ? .nan : max(a, b) }
    static func orZero(_ v: JSONValue?) -> Double { JS.truthy(v) ? JS.number(v) : 0 }

    /// 混ぜる。変わったものだけを返す（何も変わらなければ nil）
    public static func mergeSync(local: Obj, remote: JSONValue?) -> Obj? {
        guard let remote, JS.truthy(remote), case .array(let remoteEvents)? = remote["events"] else { return nil }
        var tomb = OrderedMap<Double>()
        var pairs: [JSONValue] = remote["tomb"]?.array ?? []
        for x in local["trash"]?.array ?? [] {
            let ev = x["ev"]
            pairs.append(.array([(JS.truthy(ev) ? ev?["id"] : ev) ?? .null, x["at"] ?? .null]))
        }
        pairs.append(contentsOf: local["gone"]?.array ?? [])
        for p in pairs {
            let a = p.array ?? []
            let id = a.first ?? .null
            if !JS.truthy(id) { continue }
            let at = a.count > 1 ? a[1] : nil
            // JS：Math.max(tomb.get(id) || 0, at || 0)。前の値が NaN なら || で 0 になる
            let prev = tomb[id] ?? 0
            tomb[id] = jsMax(prev.isNaN ? 0 : prev, orZero(at))
        }
        var byId = OrderedMap<JSONValue>()
        for e in local["events"]?.array ?? [] { byId[e["id"] ?? .null] = e }
        var changed = false
        for e in remoteEvents {
            guard JS.truthy(e), let id = e["id"], JS.truthy(id) else { continue }
            if let cur = byId[id] {
                if orZero(e["updatedAt"]) > orZero(cur["updatedAt"]) { byId[id] = e; changed = true }
            } else {
                if let t = tomb[id], t != 0, !t.isNaN, t >= orZero(e["updatedAt"]) { continue }
                byId[id] = e; changed = true
            }
        }
        let trashIds = (local["trash"]?.array ?? []).compactMap { x -> JSONValue? in JS.truthy(x["ev"]) ? x["ev"]?["id"] : nil }
        for id in tomb.keys {
            let at = tomb[id]!
            if let cur = byId[id], orZero(cur["updatedAt"]) <= at, !trashIds.contains(where: { $0 == id }) { byId[id] = nil; changed = true }
        }
        func keep(_ list: [JSONValue], _ idOf: (JSONValue) -> JSONValue, _ at: (JSONValue) -> Double) -> [JSONValue] {
            let out = list.filter { x in
                if let t = tomb[idOf(x)], t != 0, !t.isNaN, t >= at(x) { return false }
                return true
            }
            if out.count != list.count { changed = true }
            return out
        }
        func prefixed(_ p: String, _ v: JSONValue?) -> JSONValue { .string(p + JS.string(v)) }
        var types = keep(local["types"]?.array ?? [], { prefixed("type:", $0["key"]) }, { _ in 0 })
        for t in remote["types"]?.array ?? [] where JS.truthy(t) {
            if !types.contains(where: { $0["key"] == t["key"] }) && tomb[prefixed("type:", t["key"])] == nil { types.append(t); changed = true }
        }
        var jobs = keep(local["jobs"]?.array ?? [], { prefixed("job:", $0["id"]) }, { _ in 0 })
        for j in remote["jobs"]?.array ?? [] where JS.truthy(j) {
            if !jobs.contains(where: { $0["id"] == j["id"] }) && tomb[prefixed("job:", j["id"])] == nil { jobs.append(j); changed = true }
        }
        let shelfAt = { (x: JSONValue) -> Double in orZero(x["at"]) }
        var someday = keep(local["someday"]?.array ?? [], { $0["id"] ?? .null }, shelfAt)
        for x in remote["someday"]?.array ?? [] {
            if !JS.truthy(x) || someday.contains(where: { $0["id"] == x["id"] }) { continue }
            if let t = tomb[x["id"] ?? .null], t != 0, !t.isNaN, t >= shelfAt(x) { continue }
            someday.append(x); changed = true
        }
        if !changed { return nil }
        return ["events": .array(byId.values), "types": .array(types), "jobs": .array(jobs), "someday": .array(someday)]
    }
}
