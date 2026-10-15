import Foundation

extension Engine {
    /// 向こうから読んだ中身を混ぜる（Web 版 _pullSync の写し）。変わったら true
    @discardableResult
    public func applyRemote(_ remote: JSONValue?) -> Bool {
        var changed = false
        if let merged = SyncCore.mergeSync(local: state, remote: remote) {
            let types: JSONValue? = Loader.typesOk(merged["types"]) ? JSONValue?.some(merged["types"] ?? .null) : state["types"]
            set(["events": .array(Loader.sanitizeEvents(merged["events"], makeId: { self.uid("x") })), "types": types,
                 "jobs": .array(Loader.sanitizeJobs(merged["jobs"])), "someday": .array(Loader.sanitizeSomeday(merged["someday"]))])
            changed = true
        }
        set(["settings": .object(Self.with(settings, ["lastSyncAt": .number(now)]))])
        return changed
    }
    /// 同期を入れる／切る（入れるときは端末の印を作る）
    public func setSync(_ on: Bool) {
        haptic("light")
        set(["settings": .object(Self.with(settings, ["sync": .bool(on), "deviceId": JS.or(settings["deviceId"], .string(uid("d")))]))])
    }
}
