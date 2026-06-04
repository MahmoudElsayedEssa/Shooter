import UIKit
import WebKit

final class GameViewController: UIViewController {

    private var webView: WKWebView!

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.055, blue: 0.1, alpha: 1) // #0a0e1a

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        loadGame()
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    // MARK: - Load game from bundle

    private func loadGame() {
        // The pre-built web files live inside the app bundle at www/
        guard let wwwPath = Bundle.main.path(forResource: "www", ofType: nil) else {
            fatalError("Missing www/ folder in app bundle. Copy the dist/ output into ios/Shooter/www/")
        }

        let wwwURL = URL(fileURLWithPath: wwwPath)
        let indexURL = wwwURL.appendingPathComponent("index.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: wwwURL)
    }
}
