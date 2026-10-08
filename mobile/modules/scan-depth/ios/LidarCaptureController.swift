import ARKit
import AVFoundation
import CoreImage
import SceneKit
import UIKit

// The JPEG and metric depth always come from the same ARFrame. No GPS or
// world-space camera pose is exported. Portrait pixels are rotated clockwise.
final class LidarCaptureController: UIViewController, ARSessionDelegate {
  private let cameraView = ARSCNView()
  private let status = UILabel()
  private let captureButton = UIButton(type: .system)
  private let cancelButton = UIButton(type: .system)
  private let context = CIContext()
  private let processing = DispatchQueue(label: "com.rimonim.lidar.export")
  private var completion: (([String: Any]?, String?) -> Void)?
  private var finished = false
  private var lastUpdate: TimeInterval = 0
  private var readyFrame: ARFrame?

  init(completion: @escaping ([String: Any]?, String?) -> Void) {
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    cameraView.session.delegate = self
    view.addSubview(cameraView)
    status.numberOfLines = 0
    status.textAlignment = .center
    status.textColor = .white
    status.backgroundColor = UIColor.black.withAlphaComponent(0.75)
    status.text = "LiDAR trasero · Iniciando…\nUna granada inmóvil, de frente y con buena luz."
    captureButton.setTitle("Tomar foto con LiDAR", for: .normal)
    captureButton.backgroundColor = .systemGreen
    captureButton.setTitleColor(.black, for: .normal)
    captureButton.layer.cornerRadius = 12
    captureButton.isEnabled = false
    captureButton.addTarget(self, action: #selector(takePhoto), for: .touchUpInside)
    cancelButton.setTitle("Cancelar", for: .normal)
    cancelButton.setTitleColor(.white, for: .normal)
    cancelButton.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
    for item in [status, captureButton, cancelButton] { view.addSubview(item) }
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: UIApplication.willResignActiveNotification, object: nil)
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: start()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
        DispatchQueue.main.async {
          if allowed { self?.start() } else { self?.finish(nil, "Permití la cámara en Ajustes del teléfono.") }
        }
      }
    default: finish(nil, "Permití la cámara en Ajustes del teléfono.")
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    cameraView.frame = view.bounds
    let safe = view.safeAreaInsets
    status.frame = CGRect(x: 16, y: safe.top + 12, width: view.bounds.width - 32, height: 110)
    captureButton.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 114, width: view.bounds.width - 48, height: 52)
    cancelButton.frame = CGRect(x: 24, y: view.bounds.height - safe.bottom - 56, width: view.bounds.width - 48, height: 44)
  }

  private func start() {
    guard !finished else { return }
    let config = ARWorldTrackingConfiguration()
    config.frameSemantics = .sceneDepth
    cameraView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard frame.timestamp - lastUpdate > 0.25 else { return }
    lastUpdate = frame.timestamp
    let trackingOK: Bool
    if case .normal = frame.camera.trackingState { trackingOK = true } else { trackingOK = false }
    DispatchQueue.main.async { [weak self] in
      guard let self, !self.finished else { return }
      self.readyFrame = trackingOK && frame.sceneDepth != nil ? frame : nil
      self.captureButton.isEnabled = self.readyFrame != nil
      self.status.text = trackingOK && frame.sceneDepth != nil
        ? "LiDAR trasero disponible\nFruta inmóvil a unos 30–70 cm. Diámetro experimental."
        : "Preparando LiDAR…\nMové el teléfono suavemente y buscá buena luz."
    }
  }

  @objc private func takePhoto() {
    guard !finished, let frame = readyFrame,
          let current = cameraView.session.currentFrame,
          current.timestamp - frame.timestamp < 0.5 else { return }
    captureButton.isEnabled = false
    readyFrame = nil
    cameraView.session.pause()
    status.text = "Guardando foto y profundidad…"
    processing.async { [weak self] in
      guard let self else { return }
      do {
        let image = CIImage(cvPixelBuffer: frame.capturedImage).oriented(.right)
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let jpeg = self.context.jpegRepresentation(of: image, colorSpace: colorSpace, options: [:]),
              let metadata = self.depthMetadata(frame) else {
          throw NSError(domain: "lidar", code: 1, userInfo: [NSLocalizedDescriptionKey: "No se pudo registrar la profundidad. Reintentá."])
        }
        let cache = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let url = cache.appendingPathComponent("lidar-\(UUID().uuidString).jpg")
        try jpeg.write(to: url, options: .atomic)
        DispatchQueue.main.async {
          guard !self.finished else { try? FileManager.default.removeItem(at: url); return }
          self.finish(["uri": url.absoluteString, "depthCapture": metadata], nil)
        }
      } catch { DispatchQueue.main.async { self.finish(nil, error.localizedDescription) } }
    }
  }

  private func depthMetadata(_ frame: ARFrame) -> [String: Any]? {
    guard let depth = frame.sceneDepth, let confidence = depth.confidenceMap else { return nil }
    let map = depth.depthMap
    let width = CVPixelBufferGetWidth(map), height = CVPixelBufferGetHeight(map)
    guard width > 0, height > 0, width * height <= 100000,
          CVPixelBufferGetWidth(confidence) == width,
          CVPixelBufferGetHeight(confidence) == height else { return nil }
    CVPixelBufferLockBaseAddress(map, .readOnly)
    CVPixelBufferLockBaseAddress(confidence, .readOnly)
    defer {
      CVPixelBufferUnlockBaseAddress(map, .readOnly)
      CVPixelBufferUnlockBaseAddress(confidence, .readOnly)
    }
    guard let base = CVPixelBufferGetBaseAddress(map), let confidenceBase = CVPixelBufferGetBaseAddress(confidence) else { return nil }
    var millimeters = [Int](repeating: 0, count: width * height)
    var levels = [Int](repeating: 0, count: width * height)
    for y in 0..<height {
      let row = base.advanced(by: y * CVPixelBufferGetBytesPerRow(map)).assumingMemoryBound(to: Float32.self)
      let conf = confidenceBase.advanced(by: y * CVPixelBufferGetBytesPerRow(confidence)).assumingMemoryBound(to: UInt8.self)
      for x in 0..<width {
        // (x,y) -> (height-1-y,x), matching the clockwise JPEG rotation.
        let index = x * height + height - 1 - y
        let z = row[x]
        millimeters[index] = z.isFinite && z >= 0.15 && z <= 1.5 ? Int((z * 1000).rounded()) : 0
        levels[index] = Int(conf[x])
      }
    }
    let imageWidth = Float(CVPixelBufferGetWidth(frame.capturedImage))
    let imageHeight = Float(CVPixelBufferGetHeight(frame.capturedImage))
    let k = frame.camera.intrinsics
    // Scale intrinsics to the original depth grid, then rotate the optical center.
    let fx = k.columns.0.x * Float(width) / imageWidth
    let fy = k.columns.1.y * Float(height) / imageHeight
    let cx = k.columns.2.x * Float(width) / imageWidth
    let cy = k.columns.2.y * Float(height) / imageHeight
    return ["version": 1, "source": "arkit-scene-depth", "orientation": "portrait-clockwise",
            "width": height, "height": width, "depth_mm": millimeters, "confidence": levels,
            "intrinsics": ["fx": fy, "fy": fx, "cx": Float(height - 1) - cy, "cy": cx],
            "image_width": Int(imageHeight), "image_height": Int(imageWidth),
            "captured_at": ISO8601DateFormatter().string(from: Date()), "validation": "experimental"]
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    DispatchQueue.main.async { self.finish(nil, "No se pudo iniciar LiDAR. Volvé a abrir la captura.") }
  }
  func sessionWasInterrupted(_ session: ARSession) {
    DispatchQueue.main.async { self.finish(nil, "Se interrumpió LiDAR. Volvé a abrir la captura.") }
  }
  @objc private func cancelCapture() { finish(nil, nil) }
  @objc private func interrupted() { finish(nil, "Se interrumpió la cámara. Volvé a abrir la captura.") }
  private func finish(_ result: [String: Any]?, _ error: String?) {
    guard !finished else { return }
    finished = true
    NotificationCenter.default.removeObserver(self)
    cameraView.session.pause()
    let callback = completion
    completion = nil
    dismiss(animated: true) { callback?(result, error) }
  }
}
