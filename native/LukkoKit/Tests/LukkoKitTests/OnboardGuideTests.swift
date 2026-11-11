import XCTest
@testable import LukkoKit

/// はじめての案内の見直しと、取り込みを閉じたときの戻り先
final class OnboardGuideTests: XCTestCase {
    private let tz = TimeZone(identifier: "Asia/Tokyo")!

    private func engine(onboarded: Bool, screen: String = "month") -> Engine {
        let now = JSDate.make(2026, 10, 10, 12, 0, 0, tz)
        var st = Engine.defaultState(now: now, tz: tz)
        var s = st["settings"]?.object ?? [:]
        s["onboarded"] = .bool(onboarded)
        st["settings"] = .object(s)
        st["screen"] = .string(screen)
        return Engine(state: st, now: now, timeZone: tz)
    }

    /// 見直しても「案内を済ませた」は保存したまま。途中でアプリを閉じても、次に開いたとき案内は出ない
    func testReplayKeepsOnboarded() {
        let e = engine(onboarded: true)
        XCTAssertFalse(e.showOnboarding())
        e.replayGuide()
        XCTAssertTrue(e.showOnboarding(), "見直しで案内が出ない")
        XCTAssertEqual(e.state["settings"]?["onboarded"], .bool(true), "見直しで「済ませた」を消してしまう")
        // 保存されるものだけで開き直すと、案内は出ない（見直しの印は保存しない）
        XCTAssertFalse(StoreFile.persistedKeys.contains("onboard"))
        var reopened = Engine.defaultState(now: JSDate.make(2026, 10, 10, 12, 0, 0, tz), tz: tz)
        for k in StoreFile.persistedKeys { if let v = e.state[k] { reopened[k] = v } }
        XCTAssertFalse(Engine(state: reopened, now: 0, timeZone: tz).showOnboarding(), "閉じて開き直すと、また案内が出る")
    }

    /// 見直しを「はじめる」「スキップ」で終えると、案内は閉じる
    func testFinishGuideEndsReplay() {
        let e = engine(onboarded: true)
        e.replayGuide()
        e.finishGuide()
        XCTAssertFalse(e.showOnboarding(), "見直しを終えても案内が閉じない")
        XCTAssertNil(e.state["onboard"]?["replay"])
        // はじめての人
        let f = engine(onboarded: false)
        XCTAssertTrue(f.showOnboarding())
        f.finishGuide()
        XCTAssertFalse(f.showOnboarding())
        XCTAssertEqual(f.state["screen"], "month")
    }

    /// 取り込みを閉じたら、開いた元の画面へ戻る
    func testImportBackReturnsToOrigin() {
        let m = engine(onboarded: true, screen: "month")
        m.set(["screen": "import"])
        m.set(["screen": "import"])   // 開いたまま、もう一度入っても元は変わらない
        m.importBack()
        XCTAssertEqual(m.state["screen"], "month", "月の案内から開いたのに、月へ戻らない")

        let s = engine(onboarded: true, screen: "settings")
        s.set(["screen": "import"])
        s.importBack()
        XCTAssertEqual(s.state["screen"], "settings")

        // 元が分からないときは、今までどおり設定へ
        let n = engine(onboarded: true, screen: "import")
        n.importBack()
        XCTAssertEqual(n.state["screen"], "settings")
    }
}
