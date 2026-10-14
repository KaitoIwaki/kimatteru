import Foundation
import WebKit

/// いまの版（Web）が WebView の localStorage に置いた中身を読む（引っ越しの初回だけ使う）。
///
/// localStorage は WebKit の中にしまわれていて、ファイルとして直接は読めない。
/// そこで、いまの版と同じ場所（capacitor://localhost）を見えない WebView で開き、
/// WebKit 自身に読ませて受け取る。同じ場所・同じ保存先なので、同じ中身が見える。
///
/// 書き込み（write）は試験のためだけに使う（GitHub の Mac の試験で、いまの版が書いた状態を作る）。
@MainActor
final class LocalStorageReader: NSObject, WKURLSchemeHandler, WKScriptMessageHandler {
    private var webView: WKWebView?
    private var cont: CheckedContinuation<[String: String]?, Never>?
    private var html = ""

    /// keys の中身を読む。読めなければ nil（timeout 秒で諦める）
    static func read(keys: [String], timeout: TimeInterval = 8) async -> [String: String]? {
        let js = "const o={};" + keys.map { "o[\(quote($0))]=localStorage.getItem(\(quote($0)));" }.joined()
            + "window.webkit.messageHandlers.lukko.postMessage(JSON.stringify(o));"
        return await LocalStorageReader().run(js: js, timeout: timeout)
    }

    /// 試験用：中身を書く
    static func write(_ items: [String: String], timeout: TimeInterval = 8) async -> Bool {
        let js = items.map { "localStorage.setItem(\(quote($0.key)),\(quote($0.value)));" }.joined()
            + "window.webkit.messageHandlers.lukko.postMessage('{}');"
        return await LocalStorageReader().run(js: js, timeout: timeout) != nil
    }

    private static func quote(_ s: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: [s])
        let arr = String(data: data, encoding: .utf8)!
        return String(arr.dropFirst().dropLast())
    }

    private func run(js: String, timeout: TimeInterval) async -> [String: String]? {
        html = "<!doctype html><meta charset=utf-8><script>try{\(js)}catch(e){window.webkit.messageHandlers.lukko.postMessage('ERR')}</script>"
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.setURLSchemeHandler(self, forURLScheme: "capacitor")
        cfg.userContentController.add(self, name: "lukko")
        let wv = WKWebView(frame: .zero, configuration: cfg)
        webView = wv
        return await withCheckedContinuation { (c: CheckedContinuation<[String: String]?, Never>) in
            cont = c
            wv.load(URLRequest(url: URL(string: "capacitor://localhost/__lukko_migrate.html")!))
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in self?.finish(nil) }
        }
    }

    private func finish(_ v: [String: String]?) {
        guard let c = cont else { return }
        cont = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "lukko")
        webView = nil
        c.resume(returning: v)
    }

    // MARK: WKScriptMessageHandler
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let s = message.body as? String, s != "ERR", let d = s.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { finish(nil); return }
        var out: [String: String] = [:]
        for (k, v) in o { if let str = v as? String { out[k] = str } }
        finish(out)
    }

    // MARK: WKURLSchemeHandler（capacitor://localhost の中身を、この小さなページにする）
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let data = Data(html.utf8)
        let resp = URLResponse(url: task.request.url!, mimeType: "text/html", expectedContentLength: data.count, textEncodingName: "utf-8")
        task.didReceive(resp)
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
