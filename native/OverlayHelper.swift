import AppKit
import Foundation

struct OverlayConfig {
    let sizePx: Double
    let offsetX: Double
    let offsetY: Double
}

enum Command: String {
    case show
    case hide
    case quit
}

struct ParsedCommand {
    let cmd: Command
    let iconPath: String?
    let enterPath: String?
    let exitPath: String?
}

// MARK: - GIF helpers

struct GIFData {
    let frames: [NSImage]
    let durations: [Double]
}

func loadGIF(from path: String) -> GIFData? {
    let url = URL(fileURLWithPath: path)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }

    let count = CGImageSourceGetCount(source)
    var frames: [NSImage] = []
    var durations: [Double] = []

    for i in 0..<count {
        guard let cg = CGImageSourceCreateImageAtIndex(source, i, nil) else { continue }
        let size = NSSize(width: CGFloat(cg.width), height: CGFloat(cg.height))
        frames.append(NSImage(cgImage: cg, size: size))

        var delay = 0.1
        if let props = CGImageSourceCopyPropertiesAtIndex(source, i, nil) as? [String: Any],
           let gifProps = props[kCGImagePropertyGIFDictionary as String] as? [String: Any] {
            if let d = gifProps[kCGImagePropertyGIFUnclampedDelayTime as String] as? Double, d > 0 {
                delay = d
            } else if let d = gifProps[kCGImagePropertyGIFDelayTime as String] as? Double, d > 0 {
                delay = d
            }
        }
        durations.append(delay)
    }

    guard !frames.isEmpty else { return nil }
    return GIFData(frames: frames, durations: durations)
}

// MARK: - Overlay controller

final class OverlayWindowController {
    private let window: NSWindow
    private let imageView: NSImageView
    private let config: OverlayConfig

    private var animationTimer: Timer?
    private var currentFrames: [NSImage] = []
    private var currentDurations: [Double] = []
    private var currentIndex: Int = 0
    private var loopAnimation: Bool = false

    // Stored for transitions
    private var loopGIF: GIFData?
    private var pendingExitPath: String?

    init(config: OverlayConfig) {
        self.config = config

        let rect = NSRect(x: 0, y: 0, width: config.sizePx, height: config.sizePx)
        self.window = NSWindow(
            contentRect: rect,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false)

        self.window.level = .screenSaver
        self.window.isOpaque = false
        self.window.backgroundColor = .clear
        self.window.hasShadow = false
        self.window.ignoresMouseEvents = true
        self.window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

        self.imageView = NSImageView(frame: rect)
        self.imageView.imageScaling = .scaleAxesIndependently
        self.imageView.wantsLayer = true
        self.window.contentView = self.imageView

        self.reposition()

        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.reposition()
        }
    }

    /// Show overlay: play enter animation once, then loop icon animation
    func show(iconPath: String, enterPath: String?) {
        self.stopAnimation()
        self.reposition()
        self.window.orderFrontRegardless()

        // Load the main loop GIF
        self.loopGIF = loadGIF(from: iconPath)

        // If enter path provided, play it once first
        if let enterPath = enterPath, let enterGIF = loadGIF(from: enterPath) {
            self.playOnce(gif: enterGIF) { [weak self] in
                self?.startLoop()
            }
        } else {
            self.startLoop()
        }
    }

    /// Hide overlay: play exit animation once, then hide window
    func hide(exitPath: String?) {
        self.stopAnimation()

        if let exitPath = exitPath, let exitGIF = loadGIF(from: exitPath) {
            self.playOnce(gif: exitGIF) { [weak self] in
                self?.window.orderOut(nil)
            }
        } else {
            self.window.orderOut(nil)
        }
    }

    // MARK: - Animation engine

    private func playOnce(gif: GIFData, completion: @escaping () -> Void) {
        self.currentFrames = gif.frames
        self.currentDurations = gif.durations
        self.currentIndex = 0
        self.loopAnimation = false

        self.imageView.image = self.currentFrames[0]

        if self.currentFrames.count == 1 {
            // Single frame, just show briefly then complete
            self.animationTimer = Timer.scheduledTimer(withTimeInterval: self.currentDurations[0], repeats: false) { _ in
                completion()
            }
        } else {
            self.scheduleNextFrame(completion: completion)
        }
    }

    private func startLoop() {
        guard let gif = self.loopGIF, !gif.frames.isEmpty else {
            // If no loop GIF, just show static
            return
        }

        self.currentFrames = gif.frames
        self.currentDurations = gif.durations
        self.currentIndex = 0
        self.loopAnimation = true

        self.imageView.image = self.currentFrames[0]

        if self.currentFrames.count > 1 {
            self.scheduleNextFrame(completion: nil)
        }
    }

    private func scheduleNextFrame(completion: (() -> Void)?) {
        guard !self.currentFrames.isEmpty else { return }
        let delay = self.currentDurations[self.currentIndex]

        self.animationTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.currentIndex += 1

            if self.currentIndex >= self.currentFrames.count {
                if self.loopAnimation {
                    // Loop back
                    self.currentIndex = 0
                    self.imageView.image = self.currentFrames[0]
                    self.scheduleNextFrame(completion: nil)
                } else {
                    // One-shot done
                    completion?()
                }
            } else {
                self.imageView.image = self.currentFrames[self.currentIndex]
                self.scheduleNextFrame(completion: completion)
            }
        }
    }

    private func stopAnimation() {
        self.animationTimer?.invalidate()
        self.animationTimer = nil
        self.currentFrames = []
        self.currentDurations = []
        self.currentIndex = 0
        self.loopAnimation = false
    }

    private func reposition() {
        let targetScreen = NSScreen.screens.first(where: { $0.frame.contains(NSEvent.mouseLocation) }) ?? NSScreen.main
        guard let screen = targetScreen else { return }

        let visible = screen.visibleFrame
        let size = self.config.sizePx
        let x = visible.maxX - size - self.config.offsetX
        let y = visible.minY + self.config.offsetY
        self.window.setFrame(NSRect(x: x, y: y, width: size, height: size), display: false)
    }
}

// MARK: - CLI parsing

func parseConfig() -> OverlayConfig {
    var sizePx: Double = 96
    var offsetX: Double = 24
    var offsetY: Double = 24

    var i = 1
    while i < CommandLine.arguments.count {
        let arg = CommandLine.arguments[i]
        if arg == "--size", i + 1 < CommandLine.arguments.count {
            sizePx = Double(CommandLine.arguments[i + 1]) ?? sizePx
            i += 2; continue
        }
        if arg == "--offset-x", i + 1 < CommandLine.arguments.count {
            offsetX = Double(CommandLine.arguments[i + 1]) ?? offsetX
            i += 2; continue
        }
        if arg == "--offset-y", i + 1 < CommandLine.arguments.count {
            offsetY = Double(CommandLine.arguments[i + 1]) ?? offsetY
            i += 2; continue
        }
        i += 1
    }

    return OverlayConfig(sizePx: sizePx, offsetX: offsetX, offsetY: offsetY)
}

func parseLine(_ line: String) -> ParsedCommand? {
    guard let data = line.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let cmdRaw = raw["cmd"] as? String,
          let cmd = Command(rawValue: cmdRaw)
    else {
        return nil
    }

    return ParsedCommand(
        cmd: cmd,
        iconPath: raw["iconPath"] as? String,
        enterPath: raw["enterPath"] as? String,
        exitPath: raw["exitPath"] as? String
    )
}

// MARK: - Main

let config = parseConfig()
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

let controller = OverlayWindowController(config: config)

DispatchQueue.global(qos: .userInitiated).async {
    while let line = readLine(strippingNewline: true) {
        guard let parsed = parseLine(line) else { continue }
        DispatchQueue.main.async {
            switch parsed.cmd {
            case .show:
                if let iconPath = parsed.iconPath {
                    controller.show(iconPath: iconPath, enterPath: parsed.enterPath)
                }
            case .hide:
                controller.hide(exitPath: parsed.exitPath)
            case .quit:
                controller.hide(exitPath: nil)
                NSApplication.shared.terminate(nil)
            }
        }
    }

    DispatchQueue.main.async {
        controller.hide(exitPath: nil)
        NSApplication.shared.terminate(nil)
    }
}

app.run()
